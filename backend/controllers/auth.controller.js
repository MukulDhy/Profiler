import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/user.model.js";
import { getDemoUser } from "../middlewares/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import sendMail from "../utils/sendMail.js";
import logger from "../utils/logger.js";
import { uploadImage } from "../utils/uploadImage.js";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === "production";

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? "strict" : "lax",
  path: "/",
  maxAge,
});

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
};

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const issueTokens = async (user, res, statusCode = 200, message = "Success") => {
  const accessToken = user.generateToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = user.hashRefreshToken(refreshToken);
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TTL_MS));
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TTL_MS));

  return res.status(statusCode).json({
    success: true,
    message,
    errorCode: 0,
    data: { user, accessToken },
  });
};

const sendVerificationEmail = async (user) => {
  const otp = user.createEmailVerificationOtp();
  await user.save({ validateBeforeSave: false });

  if (!isProduction()) {
    logger.info(`📧 Email verification OTP for ${user.email}: ${otp}`);
  }

  try {
    await sendMail({
      email: user.email,
      subject: "Verify your ProfileGPT email",
      template: "verify_email.ejs",
      data: { user, otp },
    });
  } catch (error) {
    logger.warn(`Could not send verification email to ${user.email}: ${error.message}`);
  }
};

const sendWelcomeEmail = async (user) => {
  try {
    await sendMail({
      email: user.email,
      subject: "Welcome to ProfileGPT",
      template: "welcome_mail.ejs",
      data: {
        user,
        clientUrl: process.env.CLIENT_URL || "http://localhost:8080",
      },
    });
  } catch (error) {
    logger.warn(`Could not send welcome email to ${user.email}: ${error.message}`);
  }
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({
    email: String(email).trim().toLowerCase(),
  });

  if (existing) {
    throw new AppError("An account with this email already exists.", 409, 1005);
  }

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password,
    provider: "local",
  });

  await sendWelcomeEmail(user);
  await sendVerificationEmail(user);

  return issueTokens(user, res, 201, "Account created successfully.");
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401, 1006);
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated. Contact support to restore it.",
      403,
      1003
    );
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    throw new AppError("Invalid email or password.", 401, 1006);
  }

  return issueTokens(user, res, 200, "Signed in successfully.");
});

// ─── GET /api/auth/config ─────────────────────────────────────────────────────

export const getAuthConfig = asyncHandler(async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Auth configuration fetched.",
    errorCode: 0,
    data: {
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      demoEnabled: process.env.DEMO_MODE !== "false",
      requireEmailVerification:
        process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    },
  });
});

// ─── POST /api/auth/demo ──────────────────────────────────────────────────────

export const demoLogin = asyncHandler(async (req, res) => {
  if (process.env.DEMO_MODE === "false") {
    throw new AppError("The demo account is disabled.", 404, 1004);
  }

  const user = await getDemoUser();
  return issueTokens(user, res, 200, "Signed in to the demo account.");
});

// ─── POST /api/auth/google ────────────────────────────────────────────────────
export const googleAuth = asyncHandler(async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError(
      "Google sign-in is not configured. Add GOOGLE_CLIENT_ID to the backend environment.",
      503,
      2001
    );
  }

  const { credential } = req.body;
  if (!credential) {
    throw new AppError("Google credential is required.", 400, 1009);
  }

  const client = new OAuth2Client(clientId);
  let payload;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("Google sign-in could not be verified.", 401, 1008);
  }

  if (!payload?.email) {
    throw new AppError("Google account has no email address.", 400, 1009);
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    // OAuth users get a random password; they sign in with Google or reset it.
    const randomPassword = `${crypto.randomBytes(18).toString("hex")}Aa1!`;
    user = await User.create({
      name: payload.name || email.split("@")[0],
      email,
      password: randomPassword,
      provider: "google",
      googleId: payload.sub,
      profilePicture: payload.picture || "",
      isEmailVerified: Boolean(payload.email_verified),
    });
  } else {
    if (!user.isActive) {
      throw new AppError("Your account has been deactivated.", 403, 1003);
    }
    if (!user.googleId) {
      user.googleId = payload.sub;
      user.provider = user.provider === "local" ? "local" : "google";
    }
    if (payload.picture && !user.profilePicture) {
      user.profilePicture = payload.picture;
    }
    if (payload.email_verified) user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  return issueTokens(user, res, 200, "Signed in with Google.");
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;

  if (!token) {
    throw new AppError("Refresh token is missing.", 401, 1007);
  }

  let decoded;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
  } catch {
    clearAuthCookies(res);
    throw new AppError("Refresh token is invalid or expired.", 401, 1008);
  }

  const user = await User.findById(decoded.id).select("+refreshToken");
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new AppError("Account is not available.", 401, 1002);
  }

  const incomingHash = user.hashRefreshToken(token);
  if (!user.refreshToken || user.refreshToken !== incomingHash) {
    clearAuthCookies(res);
    throw new AppError("Refresh token has been revoked.", 401, 1008);
  }

  return issueTokens(user, res, 200, "Session refreshed.");
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

export const logout = asyncHandler(async (req, res) => {
  if (req.user?._id) {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  }

  clearAuthCookies(res);
  return res.status(200).json({
    success: true,
    message: "Signed out successfully.",
    errorCode: 0,
    data: null,
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Current user fetched.",
    errorCode: 0,
    data: { user: req.user, isDemo: Boolean(req.isDemoAuth) },
  });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────

export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = [
    "name",
    "username",
    "location",
    "phone",
    "bio",
    "profilePicture",
    "githubUsername",
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No profile fields were provided.", 400, 1009);
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    errorCode: 0,
    data: { user },
  });
});

// ─── PUT /api/auth/change-password ────────────────────────────────────────────

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new AppError("User not found.", 404, 1004);

  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    throw new AppError("Current password is incorrect.", 401, 1006);
  }

  if (currentPassword === newPassword) {
    throw new AppError("New password must be different.", 400, 1009);
  }

  user.password = newPassword;
  await user.save();

  return issueTokens(user, res, 200, "Password changed successfully.");
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: String(email).trim().toLowerCase() });

  // Always return the same response so accounts cannot be enumerated.
  if (!user) {
    return res.status(200).json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
      errorCode: 0,
      data: null,
    });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
  const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

  if (!isProduction()) {
    logger.info(`🔑 Password reset link for ${user.email}: ${resetUrl}`);
  }

  try {
    await sendMail({
      email: user.email,
      subject: "Reset your ProfileGPT password",
      template: "reset_password.ejs",
      data: { user, resetUrl },
    });
  } catch (error) {
    logger.warn(`Could not send reset email to ${user.email}: ${error.message}`);
  }

  return res.status(200).json({
    success: true,
    message: "If that email exists, a reset link has been sent.",
    errorCode: 0,
    data: null,
  });
});

// ─── PUT /api/auth/reset-password/:token ──────────────────────────────────────

export const resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  }).select("+password");

  if (!user) {
    throw new AppError("Reset link is invalid or has expired.", 400, 1007);
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return issueTokens(user, res, 200, "Password reset successfully.");
});

// ─── POST /api/auth/send-verification ────────────────────────────────────────

export const sendEmailVerification = asyncHandler(async (req, res) => {
  if (req.user.isEmailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified.",
      errorCode: 0,
      data: null,
    });
  }

  await sendVerificationEmail(req.user);

  return res.status(200).json({
    success: true,
    message: "Verification code sent.",
    errorCode: 0,
    data: null,
  });
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

export const verifyEmail = asyncHandler(async (req, res) => {
  const { otp, email } = req.body;

  if (!otp) throw new AppError("Verification code is required.", 400, 1009);

  const user = req.user
    ? await User.findById(req.user._id).select(
        "+emailVerificationOtpHash"
      )
    : await User.findOne({
        email: String(email || "").trim().toLowerCase(),
      }).select("+emailVerificationOtpHash");

  if (!user) throw new AppError("Account not found.", 404, 1004);

  if (user.isEmailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified.",
      errorCode: 0,
      data: { user },
    });
  }

  const expired =
    !user.emailVerificationExpires ||
    user.emailVerificationExpires.getTime() < Date.now();

  if (expired || user.emailVerificationOtpHash !== hashOtp(String(otp))) {
    throw new AppError("Verification code is invalid or has expired.", 400, 1007);
  }

  user.isEmailVerified = true;
  user.emailVerificationOtpHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: "Email verified successfully.",
    errorCode: 0,
    data: { user },
  });
});

// ─── POST /api/auth/avatar ────────────────────────────────────────────────────

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("No image uploaded.", 400, 1009);
  }

  const result = await uploadImage(req.file.path);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePicture: result.url },
    { new: true }
  );

  return res.status(200).json({
    success: true,
    message: "Avatar updated.",
    errorCode: 0,
    data: { user, avatar: result.url },
  });
});

// ─── DELETE /api/auth/avatar ──────────────────────────────────────────────────

export const removeAvatar = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePicture: "" },
    { new: true }
  );

  return res.status(200).json({
    success: true,
    message: "Avatar removed.",
    errorCode: 0,
    data: { user },
  });
});

// ─── PUT /api/auth/deactivate ─────────────────────────────────────────────────

export const deactivateAccount = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isActive: false,
    $unset: { refreshToken: 1 },
  });

  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: "Account deactivated.",
    errorCode: 0,
    data: null,
  });
});
