// app.js

import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import bodyParser from "body-parser";
import compression from "compression";

import logger from "./utils/logger.js";
import errorHandler from "./middlewares/error.js";
import authRouter from "./routes/auth.routes.js";
import resumeRouter from "./routes/resume.routes.js";
// import {redis,RedisConnection} from "./scale/redis.js";
// import webSocketService from "./services/websocket.service.js";
// import ProFillerathonRouter from "./routes/ProFillerthon.routes.js";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors({
  origin: "http://localhost:8080",
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(bodyParser.json());

app.use(helmet());
app.use(compression());
app.use(morgan("combined", { stream: logger.stream }));

app.use(express.static(path.join(__dirname, "public")));


// RedisConnection(); 

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    data: { message: "API is running" },
    message: "Welcome to the API",
    errorCode: 0,
  });
});

app.use("/api/auth", authRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${req.originalUrl}`,
    errorCode: 3,
  });
});


// // ── Attach Socket.IO ──────────────────────────
// initSocket(server);

// Error handler middleware
app.use(errorHandler);


// Start server
const PORT = config.server.port;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
});

// WebSocket service
// For Now We dont Need it
// webSocketService.initialize(server);

// Graceful shutdown
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Export app and server
export { app, server };
app.use(errorHandler);

export default app;
