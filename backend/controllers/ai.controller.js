import mongoose from "mongoose";
import Upload from "../models/resume.model.js";
import { matchJobDescription } from "../services/aiAnalyser.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import logger from "../utils/logger.js";

// ─── POST /api/ai/job-match ──────────────────────────────────────────────────

export const jobMatch = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription } = req.body;

  if (!mongoose.Types.ObjectId.isValid(resumeId)) {
    throw new AppError("Invalid resume id.", 400, 1009);
  }

  const resume = await Upload.findOne({
    _id: resumeId,
    userId: req.user._id,
    isDeleted: false,
  }).select("profile processingStatus fileName");

  if (!resume) throw new AppError("Resume not found.", 404, 1004);
  if (resume.processingStatus !== "completed" || !resume.profile) {
    throw new AppError(
      "This resume has not finished analysing yet. Try again in a moment.",
      409,
      1003
    );
  }

  let result;
  try {
    result = await matchJobDescription({
      profile: resume.profile,
      jobDescription,
    });
  } catch (error) {
    logger.error(`Job match failed for resume ${resumeId}: ${error.message}`);
    throw new AppError(
      error.message || "The AI service could not evaluate this role.",
      502,
      2001
    );
  }

  return res.status(200).json({
    success: true,
    message: "Job match generated.",
    errorCode: 0,
    data: {
      resumeId,
      fileName: resume.fileName,
      match: result,
    },
  });
});
