import type {
  AuthConfig,
  AuthResponse,
  AuthUser,
  ChatMessageRecord,
  Conversation,
  ConversationSummary,
  GithubActivity,
  JobMatch,
  MeResponse,
  Note,
  PublicChatResponse,
  PublicProfile,
  ResumeListResponse,
  ResumeProfileResponse,
  SendMessageResponse,
  Sharing,
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

  const errors = payload.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((error) =>
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error)
      )
      .join("; ");
  }

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

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        return response.ok;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/demo",
  "/auth/google",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/verify-email",
];

async function request<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the backend at ${API_BASE}. Make sure it is running (npm run dev in backend/).`
    );
  }

  if (
    response.status === 401 &&
    allowRefresh &&
    !NO_REFRESH_PATHS.some((prefix) => path.startsWith(prefix))
  ) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, init, false);
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

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  config: () => request<AuthConfig>("/auth/config"),

  me: () => request<MeResponse>("/auth/me"),

  register: (body: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/register", json(body)),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", json(body)),

  demo: () => request<AuthResponse>("/auth/demo", { method: "POST" }),

  google: (credential: string) =>
    request<AuthResponse>("/auth/google", json({ credential })),

  logout: () => request<null>("/auth/logout", { method: "POST" }),

  updateProfile: (body: Partial<AuthUser>) =>
    request<{ user: AuthUser }>("/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
  }) =>
    request<AuthResponse>("/auth/change-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  forgotPassword: (email: string) =>
    request<null>("/auth/forgot-password", json({ email })),

  resetPassword: (token: string, password: string) =>
    request<AuthResponse>(`/auth/reset-password/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),

  sendVerification: () =>
    request<null>("/auth/send-verification", { method: "POST" }),

  verifyEmail: (body: { otp: string; email?: string }) =>
    request<{ user: AuthUser }>("/auth/verify-email", json(body)),

  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return request<{ user: AuthUser; avatar: string }>("/auth/avatar", {
      method: "POST",
      body: form,
    });
  },

  removeAvatar: () =>
    request<{ user: AuthUser }>("/auth/avatar", { method: "DELETE" }),

  deactivate: () =>
    request<null>("/auth/deactivate", { method: "PUT" }),
};

// ─── Resume ──────────────────────────────────────────────────────────────────

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

export async function listResumes(
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal
): Promise<ResumeListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ResumeListResponse>(`/resume${suffix}`, { signal });
}

export async function deleteResume(id: string): Promise<void> {
  await request(`/resume/${id}`, { method: "DELETE" });
}

export async function shareResume(id: string): Promise<Sharing> {
  const data = await request<{ sharing: Sharing }>(`/resume/${id}/share`, {
    method: "POST",
  });
  return data.sharing;
}

export async function revokeResumeShare(id: string): Promise<Sharing> {
  const data = await request<{ sharing: Sharing }>(`/resume/${id}/share`, {
    method: "DELETE",
  });
  return data.sharing;
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

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function listConversations(
  resumeId?: string
): Promise<ConversationSummary[]> {
  const suffix = resumeId
    ? `?resumeId=${encodeURIComponent(resumeId)}`
    : "";
  const data = await request<{ conversations: ConversationSummary[] }>(
    `/chat/conversations${suffix}`
  );
  return data.conversations;
}

export async function createConversation(
  resumeId: string,
  title?: string
): Promise<Conversation> {
  const data = await request<{ conversation: Conversation }>(
    "/chat/conversations",
    json({ resumeId, title })
  );
  return data.conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  const data = await request<{ conversation: Conversation }>(
    `/chat/conversations/${id}`
  );
  return data.conversation;
}

export async function sendChatMessage(
  conversationId: string,
  content: string
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>(
    `/chat/conversations/${conversationId}/messages`,
    json({ content })
  );
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/chat/conversations/${id}`, { method: "DELETE" });
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function listNotes(resumeId: string): Promise<Note[]> {
  const data = await request<{ notes: Note[] }>(
    `/notes?resumeId=${encodeURIComponent(resumeId)}`
  );
  return data.notes;
}

export async function createNote(body: {
  resumeId: string;
  body: string;
  conversationId?: string;
}): Promise<Note> {
  const data = await request<{ note: Note }>("/notes", json(body));
  return data.note;
}

export async function deleteNote(id: string): Promise<void> {
  await request(`/notes/${id}`, { method: "DELETE" });
}

// ─── Job match ───────────────────────────────────────────────────────────────

export async function matchJob(
  resumeId: string,
  jobDescription: string
): Promise<JobMatch> {
  const data = await request<{ match: JobMatch }>(
    "/ai/job-match",
    json({ resumeId, jobDescription })
  );
  return data.match;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

export async function getMyGithubActivity(): Promise<GithubActivity | null> {
  const data = await request<{
    activity: GithubActivity | null;
    username: string | null;
  }>("/github/me");
  return data.activity;
}

export async function getGithubActivity(
  username: string
): Promise<GithubActivity> {
  const data = await request<{ activity: GithubActivity }>(
    `/github/activity?username=${encodeURIComponent(username)}`
  );
  return data.activity;
}

// ─── Public sharing ──────────────────────────────────────────────────────────

export async function getPublicProfile(
  token: string
): Promise<PublicProfile> {
  return request<PublicProfile>(`/public/profile/${token}`);
}

export async function publicChat(
  token: string,
  question: string,
  messages: ChatMessageRecord[] = []
): Promise<PublicChatResponse> {
  return request<PublicChatResponse>(
    `/public/profile/${token}/chat`,
    json({
      question,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    })
  );
}
