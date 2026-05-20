import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import config from "../config/config.js";

// ─── Helper: sign tokens & send response ─────────────────────────────────────

const sendTokenResponse = async (user, statusCode, res) => {
  // Access token (short-lived)
  const accessToken = jwt.sign(
    { sub: user._id, email: user.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRE || "7d" }
  );

  // Refresh token (long-lived, httpOnly cookie)
  const refreshToken = jwt.sign(
    { sub: user._id },
    config.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

  // Store hashed refresh token in DB
  user.refreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: config.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  res
    .cookie("refreshToken", refreshToken, cookieOptions)
    .status(statusCode)
    .json({
      success: true,
      accessToken,
      user,
    });
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { name, email, password} = req.body;
    if (typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });
    }
    const existing = await User.findOne({
      email: email.trim().toLowerCase(),
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({ name, email: email.trim().toLowerCase(), password });

    await sendTokenResponse(user, 201, res);
  } catch (err) {
    // Mongoose validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(422).json({
        success: false,
        message: messages[0],
        errors: messages,
      });
    }
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Explicitly select password (it's excluded by default via toJSON transform)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    await sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
};