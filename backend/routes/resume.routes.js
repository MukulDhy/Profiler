import express from "express";
import {
  deleteUpload,
  getLatestResumeProfile,
  getResumeProfile,
  getUploadById,
  getUserUploads,
  reanalyzeUpload,
  saveAnalysis,
  updateProcessingStatus,
  uploadResumeController,
} from "../controllers/resume.controller.js";
import { uploadSingleResume } from "../helpers/uploadResume.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.use(protect);

// ── Upload ────────────────────────────────────
router.post("/", uploadSingleResume, uploadResumeController);

// ── Read ──────────────────────────────────────
router.get("/", getUserUploads);
router.get("/latest/profile", getLatestResumeProfile);
router.get("/:id/profile", getResumeProfile);
router.get("/:id", getUploadById);

// ── Analysis & Status ─────────────────────────
router.post("/:id/reanalyze", reanalyzeUpload);
router.patch("/:id/analysis", saveAnalysis);
router.patch("/:id/status", updateProcessingStatus);

router.delete("/:id", deleteUpload);

export default router;
