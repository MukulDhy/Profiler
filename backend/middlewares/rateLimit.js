import rateLimit from "express-rate-limit";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const defaultLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW, // Default: 15 minutes
  max: config.RATE_LIMIT_MAX, // Default: 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: "Too many requests, please try again later.",
    });
  },
});

// More strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: "Too many authentication attempts, please try again later.",
    });
  },
});

// Stricter limiter for device registration
const deviceRegLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 devices per day
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Device registration rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: "Device registration limit reached, please try again tomorrow.",
    });
  },
});

export { defaultLimiter, authLimiter, deviceRegLimiter };
