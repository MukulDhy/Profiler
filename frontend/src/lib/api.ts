import type {
  ResumeProfileResponse,
  UploadSummary,
} from "./types";

const FALLBACK_API_BASE = "http://localhost:5001/api";

export const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? FALLBACK_API_BASE
).replace(/\/+$/, "");

export const LAST_RESUME_KEY = "profilegpt:lastResumeId";
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".docx"];

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractMessage(body: unknown, status: number): string {
  if (!body || typeof body !== "object") {
    return `Request failed (${status}).`;
  }

  const payload = body as Record<string, unknown>;
  if (typeof payload.message === "string") return payload.message;

  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const nested = detail as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
    if (Array.isArray(nested.errors) && nested.errors.length > 0) {
      return nested.errors.map(String).join("; ");
    }
  }

  return `Request failed (${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE}. Make sure it is running (npm run dev in backend/).`
    );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(extractMessage(body, response.status), response.status);
  }

  const envelope = body as { data?: T } | null;
  return (envelope?.data ?? (body as T)) as T;
}

export function validateResumeFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const allowed = ALLOWED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));

  if (!allowed) return "Only PDF and DOCX files are supported.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_RESUME_BYTES) return "Maximum allowed file size is 5 MB.";

  return null;
}

export async function uploadResume(file: File): Promise<UploadSummary> {
  const form = new FormData();
  form.append("resume", file);

  const data = await request<{ upload: UploadSummary }>("/resume", {
    method: "POST",
    body: form,
  });

  return data.upload;
}

export async function getResumeProfile(
  id: string,
  signal?: AbortSignal
): Promise<ResumeProfileResponse> {
  return request<ResumeProfileResponse>(`/resume/${id}/profile`, { signal });
}

export async function getLatestResumeProfile(
  signal?: AbortSignal
): Promise<ResumeProfileResponse> {
  return request<ResumeProfileResponse>("/resume/latest/profile", { signal });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError("Analysis cancelled."));
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError("Analysis cancelled."));
    };

    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function reanalyzeResume(id: string): Promise<void> {
  await request(`/resume/${id}/reanalyze`, { method: "POST" });
}

export interface PollOptions {
  onStatus?: (response: ResumeProfileResponse) => void;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Polls the backend until the AI pipeline finishes (or fails / times out).
 */
export async function pollResume(
  id: string,
  {
    onStatus,
    intervalMs = 2_000,
    timeoutMs = 450_000,
    signal,
  }: PollOptions = {}
): Promise<ResumeProfileResponse> {
  const startedAt = Date.now();

  for (;;) {
    if (signal?.aborted) throw new ApiError("Analysis cancelled.");

    const response = await getResumeProfile(id, signal);
    onStatus?.(response);

    if (response.processingStatus === "completed" && response.profile) {
      return response;
    }

    if (response.processingStatus === "failed") {
      throw new ApiError(
        response.analysisMeta?.error ||
          "The analysis failed. Check the AI Analyser logs and try again."
      );
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new ApiError(
        "Analysis is taking longer than expected. It may still finish — check the dashboard in a moment."
      );
    }

    await delay(intervalMs, signal);
  }
}

export function rememberResumeId(id: string): void {
  try {
    window.localStorage.setItem(LAST_RESUME_KEY, id);
  } catch {
    // Storage may be unavailable (private mode / SSR) — non-fatal.
  }
}

export function getRememberedResumeId(): string | undefined {
  try {
    return window.localStorage.getItem(LAST_RESUME_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
