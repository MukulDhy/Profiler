import rateLimit from "express-rate-limit";
import config from "../config/config.js";
import logger from "../utils/logger.js";

const defaultLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      data: null,
      message: "Too many requests, please try again later.",
      errorCode: 1009,
    });
  },
});

// Auth limiter: generous enough for local development, still blocks abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      data: null,
      message: "Too many authentication attempts, please try again later.",
      errorCode: 1009,
    });
  },
});

// Chat messages are more expensive than normal API calls.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      message: "You are sending messages too quickly. Please slow down.",
      errorCode: 1009,
    });
  },
});

// Public (unauthenticated) endpoints.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      message: "Too many requests. Please try again shortly.",
      errorCode: 1009,
    });
  },
});

const deviceRegLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      data: null,
      message: "Device registration limit reached. Try again tomorrow.",
      errorCode: 1009,
    });
  },
});

export { defaultLimiter, authLimiter, chatLimiter, publicLimiter, deviceRegLimiter };
