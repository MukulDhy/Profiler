/**
 * First-run setup API.
 *
 * A freshly downloaded portable build has no `.env` and no database yet: the
 * frontend shows a wizard which posts the MongoDB URI and LLM key here. Once
 * written, the app reconnects and behaves like a normal install.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import logger from "../utils/logger.js";
import { reconnectDatabase } from "../config/db.js";
import {
  CONFIG_PATH,
  HOME_DIR,
  IS_PORTABLE,
  PROVIDER_ENV_KEYS,
  SUPPORTED_PROVIDERS,
  configExists,
  loadRuntimeConfig,
  readConfig,
  writeConfig,
} from "../config/runtimeConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageVersion = (() => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
    );
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/** True when a `.env`-style deployment already supplies the database. */
const envConfigured = () => Boolean(process.env.MONGO_URI);

const isSetupComplete = () => configExists() || envConfigured();

const maskMongoUri = (uri) => {
  if (!uri) return null;
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "https://"));
    return `${uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb"}://${
      parsed.hostname
    }`;
  } catch {
    return null;
  }
};

const statusPayload = () => {
  const stored = readConfig();
  const configured = isSetupComplete();

  return {
    configured,
    needsSetup: !configured,
    version: packageVersion,
    portable: IS_PORTABLE,
    home: HOME_DIR,
    configPath: CONFIG_PATH,
    storage: stored?.storage || process.env.STORAGE || "local",
    mail: stored?.mail || process.env.MAIL_MODE || "disabled",
    database: {
      connected: mongoose.connection.readyState === 1,
      host: maskMongoUri(stored?.mongoUri || process.env.MONGO_URI),
    },
    llm: {
      provider: stored?.llm?.provider || process.env.AI_PROVIDER || "",
      model: stored?.llm?.model || "",
      hasKey: Boolean(
        stored?.llm?.apiKey ||
          process.env[PROVIDER_ENV_KEYS[stored?.llm?.provider]] ||
          process.env.OPENROUTER_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.OPENAI_API_KEY
      ),
    },
    providers: SUPPORTED_PROVIDERS,
  };
};

const assertMongoUri = (uri) => {
  const value = String(uri || "").trim();
  if (!/^mongodb(\+srv)?:\/\/.+/i.test(value)) {
    throw new AppError(
      "Enter a MongoDB connection string starting with mongodb:// or mongodb+srv://.",
      400,
      3001
    );
  }
  return value;
};

const assertProvider = (provider) => {
  const value = String(provider || "").trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(value)) {
    throw new AppError(
      `Unsupported AI provider. Choose one of: ${SUPPORTED_PROVIDERS.join(", ")}.`,
      400,
      3002
    );
  }
  return value;
};

/**
 * Open a throwaway connection so the wizard can fail fast with a readable
 * message instead of leaving the user with an app that never loads.
 */
const testMongoConnection = async (uri) => {
  let connection;
  try {
    connection = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 12_000,
      connectTimeoutMS: 12_000,
    });
    await connection.asPromise();
    await connection.close();
    return true;
  } catch (error) {
    try {
      await connection?.close();
    } catch {
      // ignore
    }
    const message = /authentication failed/i.test(error.message)
      ? "MongoDB rejected the username or password in the connection string."
      : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error.message)
        ? "Could not resolve the MongoDB host. Check the cluster address and your internet connection."
        : `Could not connect to MongoDB: ${error.message}`;
    throw new AppError(message, 400, 3003);
  }
};

/** GET /api/setup/status */
export const getSetupStatus = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Setup status.",
    errorCode: 0,
    data: statusPayload(),
  });
});

/** POST /api/setup/test-mongo */
export const testMongo = asyncHandler(async (req, res) => {
  const uri = assertMongoUri(req.body?.mongoUri);
  await testMongoConnection(uri);

  res.status(200).json({
    success: true,
    message: "Connection successful.",
    errorCode: 0,
    data: { ok: true },
  });
});

/** POST /api/setup/config */
export const completeSetup = asyncHandler(async (req, res) => {
  if (configExists()) {
    throw new AppError(
      "This installation is already configured. Delete config.json to run setup again.",
      409,
      3004
    );
  }

  const mongoUri = assertMongoUri(req.body?.mongoUri);
  const provider = assertProvider(req.body?.llmProvider);
  const apiKey = String(req.body?.llmApiKey || "").trim();
  const model = String(req.body?.llmModel || "").trim();

  if (!apiKey) {
    throw new AppError("Enter an API key for the selected AI provider.", 400, 3005);
  }

  await testMongoConnection(mongoUri);

  writeConfig({
    mongoUri,
    llm: { provider, apiKey, model },
    storage: "local",
    mail: "disabled",
    jwtSecret: crypto.randomBytes(48).toString("hex"),
    jwtRefreshSecret: crypto.randomBytes(48).toString("hex"),
  });

  // Push the new values into process.env and make sure secrets exist.
  loadRuntimeConfig();

  await reconnectDatabase(mongoUri);

  logger.info(`Setup completed (provider: ${provider}, db: ${maskMongoUri(mongoUri)})`);

  res.status(200).json({
    success: true,
    message: "Setup complete. Starting ProfileGPT…",
    errorCode: 0,
    data: { ...statusPayload(), configured: true, needsSetup: false },
  });
});

/**
 * POST /api/setup/llm
 *
 * Update the provider/key without redoing the database step. Guarded to local
 * requests by the binding in `app.js` (the server only listens on loopback).
 */
export const updateLlm = asyncHandler(async (req, res) => {
  const stored = readConfig();
  if (!stored) {
    throw new AppError("Run the setup wizard first.", 409, 3006);
  }

  const provider = assertProvider(req.body?.llmProvider);
  const apiKey = String(req.body?.llmApiKey || "").trim();
  const model = String(req.body?.llmModel || "").trim();

  if (!apiKey) {
    throw new AppError("Enter an API key for the selected AI provider.", 400, 3005);
  }

  writeConfig({ ...stored, llm: { provider, apiKey, model } });
  loadRuntimeConfig();

  res.status(200).json({
    success: true,
    message: "AI provider updated. Restart the analyser to apply it.",
    errorCode: 0,
    data: statusPayload(),
  });
});

export default {
  getSetupStatus,
  testMongo,
  completeSetup,
  updateLlm,
};
