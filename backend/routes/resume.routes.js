import express from "express";
import {
  deleteUpload,
  getUploadById,
  getUserUploads,
  saveAnalysis,
  updateProcessingStatus,
  uploadResumeController,
} from "../controllers/resume.controller.js";
import { protect } from "../middlewares/auth.js";
// import { upload } from "../helpers/cloudinary.js";

const router = express.Router();

router.use(protect);

router.post("/", uploadResumeController);

router.get("/", getUserUploads);
router.get("/:id", getUploadById);

router.delete("/:id", deleteUpload);

// ── Analysis & Status ─────────────────────────
router.patch("/:id/analysis", saveAnalysis);
router.patch("/:id/status", updateProcessingStatus);

export default router;