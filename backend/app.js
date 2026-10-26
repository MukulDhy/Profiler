import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import http from "http";
import compression from "compression";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

import config from "./config/config.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";
import errorHandler from "./middlewares/error.js";
import { configCloudinary } from "./utils/uploadImage.js";
import { UPLOADS_DIR, WEB_DIR } from "./config/runtimeConfig.js";
import authRouter from "./routes/auth.routes.js";
import resumeRouter from "./routes/resume.routes.js";
import chatRouter from "./routes/chat.routes.js";
import noteRouter from "./routes/note.routes.js";
import publicRouter from "./routes/public.routes.js";
import aiRouter from "./routes/ai.routes.js";
import githubRouter from "./routes/github.routes.js";
import setupRouter from "./routes/setup.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

const isTest = process.env.NODE_ENV === "test";

/** A built SPA next to `backend/` turns this into a single-process desktop app. */
const WEB_SHELL =
  [path.join(WEB_DIR, "index.html"), path.join(WEB_DIR, "_shell.html")].find(
    (candidate) => fs.existsSync(candidate)
  ) || null;
const hasWebBuild = Boolean(WEB_SHELL);

/**
 * The SPA shell ships a couple of inline bootstrap scripts (TanStack Router
 * hydration). Hash them so the strict CSP below keeps working instead of
 * falling back to 'unsafe-inline'.
 */
const inlineScriptHashes = (() => {
  if (!WEB_SHELL) return [];
  try {
    const html = fs.readFileSync(WEB_SHELL, "utf8");
    const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    const hashes = [];
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (!match[1].trim()) continue;
      hashes.push(
        `'sha256-${crypto
          .createHash("sha256")
          .update(match[1], "utf8")
          .digest("base64")}'`
      );
    }
    return hashes;
  } catch {
    return [];
  }
})();

if (!isTest) {
  if (config.runtime?.hasDatabase) {
    connectDB();
  } else {
    logger.warn(
      "Starting in setup mode — open the app to configure MongoDB and an AI provider."
    );
  }
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

// The desktop build serves the UI from this same server, so cross-origin
// requests only happen in development. Still allow loopback in any port.
const isLoopbackOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin || "");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        isLoopbackOrigin(origin) ||
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
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    // A sensible policy for the bundled SPA; Google sign-in needs its origins.
    contentSecurityPolicy: hasWebBuild
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              ...inlineScriptHashes,
              "https://accounts.google.com",
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://accounts.google.com"],
            frameSrc: ["'self'", "https://accounts.google.com"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            // The desktop build is served over plain HTTP on loopback; Helmet's
            // default `upgrade-insecure-requests` would rewrite asset URLs to
            // https://127.0.0.1 and break the app.
            upgradeInsecureRequests: null,
          },
        }
      : undefined,
  })
);
app.use(compression());
app.use(morgan("combined", { stream: logger.stream }));

// Locally stored resumes and avatars.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    index: false,
    dotfiles: "deny",
    fallthrough: true,
    maxAge: "1h",
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Built SPA (desktop / portable builds)
// ─────────────────────────────────────────────────────────────────────────────

if (hasWebBuild) {
  app.use(
    express.static(WEB_DIR, {
      index: false,
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        // The HTML shell must never be cached or users get a stale bundle.
        if (filePath.endsWith("index.html") || filePath.endsWith("_shell.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

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
      portable: Boolean(config.runtime?.isPortable),
      configured: Boolean(config.runtime?.configured),
    },
    message: "Health check",
    errorCode: 0,
  });
});

// When the API has no UI build next to it, keep the historical JSON greeting.
if (!hasWebBuild) {
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      data: { message: "API is running" },
      message: "Welcome to the ProfileGPT API",
      errorCode: 0,
    });
  });
}

// Routes
app.use("/api/setup", setupRouter);
app.use("/api/auth", authRouter);
// Backwards-compatible alias for older clients/tests.
app.use("/api/user", authRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/chat", chatRouter);
app.use("/api/notes", noteRouter);
app.use("/api/public", publicRouter);
app.use("/api/ai", aiRouter);
app.use("/api/github", githubRouter);

// Client-side routing fallback: every non-API GET renders the SPA shell.
if (hasWebBuild) {
  app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => {
    res.sendFile(WEB_SHELL);
  });
}

// 404 handler for the API
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
  server.listen(PORT, config.server.host, () => {
    logger.info(
      `Server running in ${config.NODE_ENV} mode on http://${config.server.host}:${PORT}`
    );
    if (hasWebBuild) logger.info(`Serving web UI from ${WEB_DIR}`);
  });

  process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
}

export { app, server };
