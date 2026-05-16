import express from "express";
// import {
//   register,
//   login,
//   googleAuth,
//   getMe,
//   updateProfile,
//   changePassword,
//   forgotPassword,
//   resetPassword,
//   sendEmailVerification,
//   verifyEmail,
//   logout,
//   deactivateAccount,
//   verifyingProfile,
//   verifyOtp,
//   uploadAvatar,
//   removeAvatar,
//   updateSocialLinks,
// } from "../controllers/auth.controller.js";
import { protect } from "../middlewares/auth.js";
import { validateRegistration, validateLogin } from "../utils/validators.js";

const router = express.Router();

// Public routes
// router.post("/register", validateRegistration, register);
// router.post("/login", validateLogin, login);
// router.post("/google", googleAuth);
// router.post("/forgot-password", forgotPassword);
// router.post("/verify-otp", verifyOtp);
// router.post("/reset-password", resetPassword);
// router.put("/reset-password/:token", resetPassword);

// router.get("/verify-email/:token", verifyEmail);
// Protected routes (require authentication)
router.use(protect); // All routes after this middleware require authentication
// router.get("/verify", verifyingProfile);
// router.get("/me", getMe);
// router.put("/profile", updateProfile);
// router.post("/upload-avatar", uploadAvatar);
// router.delete("/remove-avatar", removeAvatar);
// router.put("/social-links", updateSocialLinks);
// router.put("/change-password", changePassword);
// router.post("/send-verification", sendEmailVerification);
// router.post("/logout", logout);
// router.put("/deactivate", deactivateAccount);

export default router;
