/**
 * Portable / desktop runtime configuration.
 *
 * The shipped ZIP has no `.env` file. Instead the app reads `config.json` from
 * its data directory (written by the first-run setup wizard) and maps it onto
 * the environment variables the rest of the backend already understands.
 *
 * Layout in a portable bundle:
 *
 *   ProfileGPT-1.0.0-win64/
 *   ├─ portable.flag        ← marks the folder as the data home
 *   ├─ ProfileGPT.exe
 *   ├─ backend/             ← this file lives here
 *   ├─ web/
 *   ├─ ai/
 *   └─ runtime/
 *
 * In development (no `portable.flag`) the data home falls back to
 * `%APPDATA%\ProfileGPT`, and `.env` keeps working exactly as before.
 */

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Folder that contains `backend/` — the root of the portable bundle. */
export const APP_ROOT = path.resolve(__dirname, "..", "..");

const PORTABLE_MARKER = path.join(APP_ROOT, "portable.flag");

export const isTest = () => process.env.NODE_ENV === "test";

const resolveHome = () => {
  const override = (process.env.PROFILEGPT_HOME || "").trim();
  if (override) return path.resolve(override);

  // Keep test runs away from the real app data folder.
  if (isTest()) return path.join(os.tmpdir(), "profilegpt-test-home");

  // A portable build ships `portable.flag` next to the executable; everything
  // (database files, uploads, logs, config) then stays inside the folder.
  if (fs.existsSync(PORTABLE_MARKER)) return APP_ROOT;

  const base =
    process.env.APPDATA ||
    (process.env.HOME
      ? path.join(process.env.HOME, ".config")
      : process.cwd());
  return path.join(base, "ProfileGPT");
};

export const HOME_DIR = resolveHome();
export const IS_PORTABLE = path.resolve(HOME_DIR) === path.resolve(APP_ROOT);

export const DATA_DIR = path.join(HOME_DIR, "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const LOGS_DIR = path.join(HOME_DIR, "logs");
export const CONFIG_PATH = path.join(HOME_DIR, "config.json");

/** Static frontend build served by Express in desktop builds. */
export const WEB_DIR = process.env.PROFILEGPT_WEB_DIR
  ? path.resolve(process.env.PROFILEGPT_WEB_DIR)
  : path.resolve(APP_ROOT, "web");

/** Provider name → environment variable expected by the Python analyser. */
export const PROVIDER_ENV_KEYS = {
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_ENV_KEYS);

export const DEFAULT_CONFIG = {
  version: 1,
  mongoUri: "",
  llm: { provider: "openrouter", apiKey: "", model: "" },
  jwtSecret: "",
  jwtRefreshSecret: "",
  storage: "local",
  mail: "disabled",
  createdAt: null,
  updatedAt: null,
};

const safeReadJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};

/** Read `config.json`, returning `null` when the app has not been set up yet. */
export const readConfig = () => {
  if (isTest()) return null;
  return safeReadJson(CONFIG_PATH);
};

export const configExists = () => {
  if (isTest()) return false;
  return fs.existsSync(CONFIG_PATH);
};

/**
 * Persist the config as atomically as we can (temp file + rename) and restrict
 * it to the current user where the OS supports POSIX modes.
 */
export const writeConfig = (config) => {
  if (isTest()) return config;

  const withTimestamps = {
    ...DEFAULT_CONFIG,
    ...config,
    llm: { ...DEFAULT_CONFIG.llm, ...(config.llm || {}) },
    updatedAt: new Date().toISOString(),
    createdAt: config.createdAt || new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(withTimestamps, null, 2)}\n`, "utf8");
  try {
    fs.chmodSync(tmp, 0o600);
  } catch {
    // Windows ignores POSIX modes; the launcher tightens the ACL instead.
  }
  fs.renameSync(tmp, CONFIG_PATH);
  return withTimestamps;
};

/** True once both a database URI and an LLM key are available. */
export const isConfigured = (config = readConfig()) =>
  Boolean(config?.mongoUri && config?.llm?.apiKey);

export const ensureDirs = () => {
  if (isTest()) return;
  for (const dir of [HOME_DIR, DATA_DIR, UPLOADS_DIR, LOGS_DIR]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Best effort — a read-only folder surfaces later with a clear error.
    }
  }
};

const generateSecret = () => crypto.randomBytes(48).toString("hex");

/**
 * Map `config.json` onto `process.env` without clobbering values that are
 * already set (so `.env`, CI and real environment variables always win).
 */
export const applyConfigToEnv = (config) => {
  if (!config) return;

  const setIfEmpty = (key, value) => {
    if (!value) return;
    if (process.env[key] !== undefined && process.env[key] !== "") return;
    process.env[key] = String(value);
  };

  setIfEmpty("MONGO_URI", config.mongoUri);
  setIfEmpty("STORAGE", config.storage || "local");
  setIfEmpty("MAIL_MODE", config.mail || "disabled");

  if (config.mongoUri) process.env.MONGO_URI = process.env.MONGO_URI || config.mongoUri;

  const provider = (config.llm?.provider || "").toLowerCase();
  const apiKey = config.llm?.apiKey || "";
  const keyEnv = PROVIDER_ENV_KEYS[provider];
  if (keyEnv && apiKey) setIfEmpty(keyEnv, apiKey);
  if (provider) setIfEmpty("AI_PROVIDER", provider);
  if (config.llm?.model) setIfEmpty("AI_MODEL", config.llm.model);

  setIfEmpty("JWT_SECRET", config.jwtSecret);
  setIfEmpty("JWT_REFRESH_SECRET", config.jwtRefreshSecret);

  // Share links and password-reset links must point at the local origin in a
  // portable install (there is no public hostname).
  if (IS_PORTABLE) {
    setIfEmpty("CLIENT_URL", `http://127.0.0.1:${process.env.PORT || 5001}`);
  }
};

/**
 * Called once by `config/config.js` before dotenv runs.
 *
 * Generates and persists JWT secrets the first time the app is configured, so
 * every install gets unique session signing keys.
 */
export const loadRuntimeConfig = () => {
  if (isTest()) return null;

  const config = readConfig();
  if (!config) {
    // Not configured yet: leave the environment untouched so the setup API and
    // development `.env` keep working.
    return null;
  }

  let next = config;
  if (!next.jwtSecret || !next.jwtRefreshSecret) {
    next = writeConfig({
      ...next,
      jwtSecret: next.jwtSecret || generateSecret(),
      jwtRefreshSecret: next.jwtRefreshSecret || generateSecret(),
    });
  }

  ensureDirs();
  applyConfigToEnv(next);
  return next;
};

export default {
  APP_ROOT,
  HOME_DIR,
  IS_PORTABLE,
  DATA_DIR,
  UPLOADS_DIR,
  LOGS_DIR,
  CONFIG_PATH,
  WEB_DIR,
  PROVIDER_ENV_KEYS,
  SUPPORTED_PROVIDERS,
  readConfig,
  writeConfig,
  configExists,
  isConfigured,
  ensureDirs,
  applyConfigToEnv,
  loadRuntimeConfig,
};
