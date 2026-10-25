import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import bodyParser from "body-parser";
import http from "http";
import compression from "compression";
import { fileURLToPath } from "url";
import { dirname } from "path";

import config from "./config/config.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import errorHandler from "./middlewares/error.js";
import { configCloudinary } from "./utils/uploadImage.js";
import authRouter from "./routes/auth.routes.js";
import resumeRouter from "./routes/resume.routes.js";
import chatRouter from "./routes/chat.routes.js";
import noteRouter from "./routes/note.routes.js";
import publicRouter from "./routes/public.routes.js";
import aiRouter from "./routes/ai.routes.js";
import githubRouter from "./routes/github.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

const isTest = process.env.NODE_ENV === "test";

if (!isTest) {
  connectDB();
}
configCloudinary();

app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(bodyParser.json());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan("combined", { stream: logger.stream }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    data: { message: "API is running" },
    message: "Welcome to the ProfileGPT API",
    errorCode: 0,
  });
});

app.get("/api/health", async (_req, res) => {
  let ai = { reachable: false };
  try {
    const { aiAnalyserHealth } = await import("./services/aiAnalyser.service.js");
    const health = await aiAnalyserHealth();
    ai = { reachable: true, ...health };
  } catch (error) {
    ai = { reachable: false, error: error.message };
  }

  res.json({
    success: true,
    data: {
      status: "ok",
      uptime: process.uptime(),
      database:
        (await import("mongoose")).default.connection.readyState === 1
          ? "connected"
          : "disconnected",
      ai,
    },
    message: "Health check",
    errorCode: 0,
  });
});

// Routes
app.use("/api/auth", authRouter);
// Backwards-compatible alias for older clients/tests.
app.use("/api/user", authRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/chat", chatRouter);
app.use("/api/notes", noteRouter);
app.use("/api/public", publicRouter);
app.use("/api/ai", aiRouter);
app.use("/api/github", githubRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${req.originalUrl}`,
    errorCode: 1004,
  });
});

app.use(errorHandler);

const PORT = config.server.port;
if (!isTest) {
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
  });

  process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

export { app, server };
