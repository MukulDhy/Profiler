import colors from "colors";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    } else {
      throw error; // in test just throw so jest can catch it
    }
  }
};

export default connectDB;
