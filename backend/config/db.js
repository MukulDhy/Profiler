import colors from "colors";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import config from "./config.js";

/**
 * Connect to MongoDB.
 *
 * In a portable build the app must stay alive even when the database is
 * unreachable, otherwise the setup wizard (and its error messages) would be
 * impossible to reach. Development keeps the original fail-fast behaviour.
 */
const connectDB = async (uri = process.env.MONGO_URI) => {
  if (!uri) {
    logger.warn(
      "No MongoDB URI configured yet — running in setup mode (the setup wizard is available)."
    );
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log(
      `DataBase is Connected to Server ${process.env.PORT} and ${conn.connection.host}:${conn.connection.port}`
        .underline.bgBlue
    );
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    console.log(`Error Occured : ${error.message}`.underline.bgRed);

    if (process.env.NODE_ENV === "test") {
      throw error; // in test just throw so jest can catch it
    }

    if (!config.runtime?.isPortable) {
      process.exit(1);
    }

    return null;
  }
};

/** Swap the connection at runtime (used by the setup wizard). */
export const reconnectDatabase = async (uri) => {
  try {
    await mongoose.disconnect();
  } catch {
    // Nothing was connected yet.
  }
  return connectDB(uri);
};

export default connectDB;
