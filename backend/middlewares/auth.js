import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// ─── Protect routes ───────────────────────────────────────────────────────────

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub);

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
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

// ─── Grant access to specific roles ──────────────────────────────────────────

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

// ─── Require email verification ───────────────────────────────────────────────

export const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to access this resource",
    });
  }
  next();
};

// ─── Optional auth ────────────────────────────────────────────────────────────

export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.sub);
        if (user && user.isActive) req.user = user;
      } catch {
        console.log("Invalid token in optional auth");
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};

// ─── Admin special auth ───────────────────────────────────────────────────────

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
    console.error("Admin special auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in admin authentication",
    });
  }
};