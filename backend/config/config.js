import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const config = {
  // Server
  server: {
    host: process.env.HOST || "192.168.0.103",
    port: process.env.PORT || 5001,
  },

  // CORS
  cors: {
    allowedOrigins: [
      "*",
      "http://localhost:3000",
      "http://192.168.0.103:8081",
      "http://192.168.0.103:5000",
    ],
  },

  // Environment
  JWT_COOKIE_EXPIRE: process.env.JWT_COOKIE_EXPIRE || 20,
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  // Database
  MONGO_URI:
    process.env.MONGO_URI || "mongodb://localhost:27017/care-management",

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key_here",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "30d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your_refresh_secret",

  // MQTT

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // WebSocket
  WEBSOCKET_PATH: process.env.WEBSOCKET_PATH || "/ws",

  // Notification
  NOTIFICATION_CHECK_INTERVAL:
    parseInt(process.env.NOTIFICATION_CHECK_INTERVAL) || 60000, // 1 minute

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
