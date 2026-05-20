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

app.use(errorHandler);

export default app;