import path from "path";
import "./env.js";
import { fileURLToPath } from "url";
import {
  loadRuntimeConfig,
  HOME_DIR,
  IS_PORTABLE,
  CONFIG_PATH,
} from "./runtimeConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Portable builds read `config.json` (written by the setup wizard) and map it
// onto environment variables. `.env` is loaded by ./env.js for development.
loadRuntimeConfig();

const mongoUri = process.env.MONGO_URI || "";
const serverPort = Number(process.env.PORT || 5001);
const localOrigin = `http://127.0.0.1:${serverPort}`;

const config = {
  // Server — loopback only by default; the desktop app is a single-user tool.
  server: {
    host: process.env.HOST || "127.0.0.1",
    port: serverPort,
  },

  // CORS
  cors: {
    allowedOrigins: [
      "*",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ],
  },

  // Runtime
  runtime: {
    home: HOME_DIR,
    configPath: CONFIG_PATH,
    isPortable: IS_PORTABLE,
    hasDatabase: Boolean(mongoUri),
    configured: Boolean(mongoUri),
  },

  // Storage: "local" keeps resumes in the app's data folder, "cloudinary"
  // keeps the hosted behaviour.
  storage: (process.env.STORAGE || "local").toLowerCase(),
  // Mail: "disabled" skips outbound email (verification codes are logged).
  mailMode: (
    process.env.MAIL_MODE ||
    (process.env.SMTP_MAIL && process.env.SMTP_PASSWORD ? "smtp" : "disabled")
  ).toLowerCase(),

  // Environment
  JWT_COOKIE_EXPIRE: process.env.JWT_COOKIE_EXPIRE || 20,
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_URL:
    process.env.CLIENT_URL ||
    (IS_PORTABLE ? localOrigin : "http://localhost:8080"),

  // Database
  MONGO_URI: mongoUri || "mongodb://localhost:27017/care-management",
  hasMongoUri: Boolean(mongoUri),

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key_here",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "30d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your_refresh_secret",

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // SMTP / Mail
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: process.env.SMTP_PORT || 465,
  SMTP_SERVICE: process.env.SMTP_SERVICE || "gmail",
  SMTP_MAIL: process.env.SMTP_MAIL || "example@gmail.com",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "password_here",
};

// Validate required configurations
if (!config.JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined in environment variables");
}

export default config;
