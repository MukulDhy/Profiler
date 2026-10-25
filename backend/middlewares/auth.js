import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";

const DEMO_EMAIL = "demo@profilegpt.local";
const DEMO_PASSWORD = "Demo@12345";

const demoModeEnabled = () => process.env.DEMO_MODE !== "false";

/**
 * Returns (and creates on first use) the shared demo account. This lets the
 * upload → analysis pipeline work before real authentication ships.
 */
const getDemoUser = async () => {
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

// Protect routes - verify JWT token, with a demo fallback for local use
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Check for token in cookies (only if a cookie parser populated them)
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: "Not authorized to access this route",
        });
      }

      const user = await User.findById(decoded.id || decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "No user found with this token",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account has been deactivated",
        });
      }

      req.user = user;
      return next();
    }

    // No token → fall back to the shared demo account (unless disabled).
    if (demoModeEnabled()) {
      req.user = await getDemoUser();
      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user is email verified
export const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to access this resource",
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id || decoded.userId);
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
        message: "Unauthorized: Missing admin credentials",
      });
    }

    const adminUser = await User.findOne({ email, role: "admin" });

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid admin credentials",
      });
    }

    req.user = adminUser;
    next();
  } catch (error) {
    logger.error(`Admin special auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Server error in admin authentication",
    });
  }
};
