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
