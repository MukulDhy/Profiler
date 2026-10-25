import axios from "axios";
import fs from "fs";
import logger from "../utils/logger.js";

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 450_000;
const MAX_ATTEMPTS = 2;

const baseUrl = () =>
  (process.env.AI_ANALYSER_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

const timeoutMs = () =>
  Number(process.env.AI_ANALYSER_TIMEOUT) || DEFAULT_TIMEOUT_MS;

const serviceHeaders = () => {
  const token = (process.env.AI_SERVICE_TOKEN || "").trim();
  return token ? { "x-service-token": token } : {};
};

const extractErrorMessage = (error) => {
  const payload = error?.response?.data;

  if (payload) {
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail?.message) return payload.detail.message;
    if (typeof payload.message === "string") return payload.message;
    try {
      return JSON.stringify(payload).slice(0, 500);
    } catch {
      // fall through
    }
  }

  if (error?.code === "ECONNREFUSED") {
    return `AI Analyser is not reachable at ${baseUrl()}. Start it with "uv run python main.py" inside AiAnalyser/.`;
  }

  return error?.message || "AI Analyser request failed.";
};

/**
 * POST to the AI service, retrying transient failures. 4xx responses mean the
 * document/content is the problem, so they are not retried.
 */
const postForProfile = async (url, payload, config = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await axios.post(url, payload, {
        timeout: timeoutMs(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        ...config,
        headers: { ...serviceHeaders(), ...(config.headers || {}) },
      });

      const body = data?.data;
      if (!body?.profile) {
        throw new Error("AI Analyser returned an empty profile.");
      }

      return {
        profile: body.profile,
        extractedText: body.extractedText || "",
        meta: body.meta || {},
      };
    } catch (error) {
      lastError = error;

      const status = error?.response?.status;
      if (status && status >= 400 && status < 500) break;

      logger.warn(
        `AI Analyser attempt ${attempt}/${MAX_ATTEMPTS} failed: ${extractErrorMessage(error)}`
      );

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }
  }

  const wrapped = new Error(extractErrorMessage(lastError));
  wrapped.statusCode = lastError?.response?.status || 502;
  wrapped.cause = lastError;
  throw wrapped;
};

/**
 * Send a resume file to the Python AI Analyser.
 *
 * @returns {Promise<{ profile: object, extractedText: string, meta: object }>}
 */
export const analyzeResume = async ({
  filePath,
  fileName,
  mimeType,
  provider,
  model,
}) => {
  const buffer = await fs.promises.readFile(filePath);

  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: mimeType || "application/octet-stream" }),
    fileName || "resume.pdf"
  );
  if (provider) form.append("provider", provider);
  if (model) form.append("model", model);

  return postForProfile(`${baseUrl()}/api/v1/analyze`, form);
};

/**
 * Re-run only the LLM stage against text extracted earlier. Skips Docling and
 * avoids re-downloading the original file from storage.
 */
export const analyzeResumeText = async ({
  text,
  fileName = "resume.txt",
  provider,
  model,
}) =>
  postForProfile(`${baseUrl()}/api/v1/analyze/text`, {
    text,
    file_name: fileName,
    provider,
    model,
  });

export const aiAnalyserHealth = async () => {
  const { data } = await axios.get(`${baseUrl()}/health`, {
    timeout: 5_000,
    headers: serviceHeaders(),
  });
  return data;
};

/**
 * POST a JSON payload to the AI service and return its `data` object.
 * Chat and job-match are fast, so they use a shorter timeout than the
 * document-analysis pipeline.
 */
const postJson = async (path, payload, timeout = 120_000) => {
  try {
    const { data } = await axios.post(`${baseUrl()}${path}`, payload, {
      timeout,
      headers: { "Content-Type": "application/json", ...serviceHeaders() },
    });

    if (!data?.data) {
      throw new Error("AI Analyser returned an empty response.");
    }

    return data.data;
  } catch (error) {
    const wrapped = new Error(extractErrorMessage(error));
    wrapped.statusCode = error?.response?.status || 502;
    wrapped.cause = error;
    throw wrapped;
  }
};

/**
 * Answer a question grounded in the full structured profile + extracted text.
 *
 * @returns {Promise<{ answer: string, suggestions: string[], provider?: string, model?: string }>}
 */
export const chatWithProfile = async ({
  profile,
  extractedText = "",
  messages = [],
  question,
  provider,
  model,
}) =>
  postJson("/api/v1/chat", {
    profile: profile || {},
    extracted_text: extractedText || "",
    messages: (messages || []).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    question,
    provider,
    model,
  });

/**
 * Score a profile against a job description.
 *
 * @returns {Promise<{ score: number, matchedKeywords: string[], missingKeywords: string[], strengths: string[], gaps: string[], suggestions: string[], verdict: string }>}
 */
export const matchJobDescription = async ({
  profile,
  jobDescription,
  provider,
  model,
}) =>
  postJson("/api/v1/job-match", {
    profile: profile || {},
    job_description: jobDescription,
    provider,
    model,
  });

