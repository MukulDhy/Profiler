import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";

const DEMO_EMAIL = "demo@profilegpt.local";
const DEMO_PASSWORD = "Demo@12345";

const demoModeEnabled = () => process.env.DEMO_MODE !== "false";

const getTokenFromRequest = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return req.cookies?.accessToken || req.cookies?.token;
};

/**
 * Returns (and creates on first use) the shared demo account. This lets the
 * upload → analysis pipeline work before real authentication ships.
 */
export const getDemoUser = async () => {
  let user = await User.findOne({ email: DEMO_EMAIL });

  if (!user) {
    try {
      user = await User.create({
        email: DEMO_EMAIL,
        name: "Demo Candidate",
        username: "democandidate",
        password: DEMO_PASSWORD,
        role: "user",
        isEmailVerified: true,
        isActive: true,
      });
      logger.info(`👤 Demo user created: ${DEMO_EMAIL}`);
    } catch (error) {
      // Another request may have created it concurrently.
      user = await User.findOne({ email: DEMO_EMAIL });
      if (!user) throw error;
    }
  }

  return user;
};

const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key_here");

// Protect routes - verify JWT token, with a demo fallback for local use
export const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (token) {
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch {
        return res.status(401).json({
          success: false,
          data: null,
          message: "Not authorized to access this route",
          errorCode: 1008,
        });
      }

      const user = await User.findById(decoded.id || decoded.sub || decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          data: null,
          message: "No user found with this token",
          errorCode: 1004,
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          data: null,
          message: "User account has been deactivated",
          errorCode: 1003,
        });
      }

      req.user = user;
      return next();
    }

    // No token → fall back to the shared demo account (unless disabled).
    if (demoModeEnabled()) {
      req.user = await getDemoUser();
      req.isDemoAuth = true;
      return next();
    }

    return res.status(401).json({
      success: false,
      data: null,
      message: "Not authorized to access this route",
      errorCode: 1002,
    });
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error in authentication",
      errorCode: 2001,
    });
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        message: `User role ${req.user.role} is not authorized to access this route`,
        errorCode: 1003,
      });
    }
    next();
  };
};

// Check if user is email verified (opt-in via env so local demo still works)
export const requireEmailVerification = (req, res, next) => {
  if (
    process.env.REQUIRE_EMAIL_VERIFICATION === "true" &&
    !req.user.isEmailVerified
  ) {
    return res.status(403).json({
      success: false,
      data: null,
      message: "Please verify your email address to access this resource",
      errorCode: 1003,
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(
          decoded.id || decoded.sub || decoded.userId
        );
        if (user && user.isActive) {
          req.user = user;
        }
      } catch {
        // Invalid token — continue anonymously.
      }
    }

    next();
  } catch (error) {
    logger.error(`Optional auth middleware error: ${error.message}`);
    next();
  }
};

export const adminSpecialAuth = async (req, res, next) => {
  try {
    const email = req.headers["x-admin-email"];

    if (!email) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Unauthorized: Missing admin credentials",
        errorCode: 1002,
      });
    }

    const adminUser = await User.findOne({ email, role: "admin" });

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Unauthorized: Invalid admin credentials",
        errorCode: 1006,
      });
    }

    req.user = adminUser;
    next();
  } catch (error) {
    logger.error(`Admin special auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Server error in admin authentication",
      errorCode: 2001,
    });
  }
};
