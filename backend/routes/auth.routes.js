import express from "express";
import {
  changePassword,
  deactivateAccount,
  demoLogin,
  forgotPassword,
  getAuthConfig,
  getMe,
  googleAuth,
  login,
  logout,
  refresh,
  register,
  removeAvatar,
  resetPassword,
  sendEmailVerification,
  updateProfile,
  uploadAvatar,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { optionalAuth, protect } from "../middlewares/auth.js";
import { authLimiter } from "../middlewares/rateLimit.js";
import { upload } from "../utils/uploadImage.js";
import {
  validateEmail,
  validateGoogleAuth,
  validateLogin,
  validatePasswordChange,
  validatePasswordReset,
  validateProfileUpdate,
  validateRegistration,
} from "../utils/validators.js";

const router = express.Router();

// ─── Public routes ────────────────────────────────────────────────────────────
router.get("/config", getAuthConfig);
router.post("/register", authLimiter, validateRegistration, register);
router.post("/login", authLimiter, validateLogin, login);
router.post("/demo", authLimiter, demoLogin);
router.post("/google", authLimiter, validateGoogleAuth, googleAuth);
router.post("/refresh", refresh);
router.post("/logout", optionalAuth, logout);
router.post("/forgot-password", authLimiter, validateEmail, forgotPassword);
router.put(
  "/reset-password/:token",
  authLimiter,
  validatePasswordReset,
  resetPassword
);
router.post("/verify-email", verifyEmail);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

router.get("/me", getMe);
router.put("/profile", validateProfileUpdate, updateProfile);
router.put("/change-password", validatePasswordChange, changePassword);
router.post("/send-verification", sendEmailVerification);
router.post("/avatar", upload.single("avatar"), uploadAvatar);
router.delete("/avatar", removeAvatar);
router.put("/deactivate", deactivateAccount);

export default router;
