import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || "",
    db: process.env.REDIS_DB || 0,
});

const RedisConnection = async () => {
    try {
        await redis.ping();
        logger.info("Connected to Redis successfully");
    } catch (error) {
        logger.error("Failed to connect to Redis:", error);
    }
};

export { redis, RedisConnection };