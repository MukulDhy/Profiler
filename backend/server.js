// server.js

import http from "http";

import app from "./app.js";
import config from "./config/config.js";
import connectDB from "./config/db.js";

import logger from "./utils/logger.js";
import { startScheduler } from "./utils/schedular.js";
import { configCloudinary } from "./utils/uploadImage.js";

const PORT = config.server.port;

const startServer = async () => {
  try {
    await connectDB();

    configCloudinary();

    const server = http.createServer(app);

    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
    });

    startScheduler();

    process.on("unhandledRejection", (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);

      server.close(() => process.exit(1));
    });

  } catch (err) {
    logger.error("Server startup failed", err);
    process.exit(1);
  }
};

startServer();