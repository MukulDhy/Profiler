import fs from "fs";
import path from "path";
import Upload from "../models/resume.model.js";
import { uploadResume } from "../helpers/uploadResume.js";
import logger from "../utils/logger.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Uniform JSON response helper.
 *
 * status values: "success" | "error" | "failure" | "internal_error"
 *   success       → 2xx, everything is fine
 *   error         → 4xx, client did something wrong
 *   failure       → business-logic failure (still 4xx-ish but distinct)
 *   internal_error→ 5xx, our fault
 */
const respond = (res, { httpCode = 200, status, message, data = {} }) =>
  res.status(httpCode).json({ status, message, data });

/**
 * POST /api/uploads
 * Upload a resume file (pdf | doc | docx) to Cloudinary and persist metadata.
 *
 * Expects:  multipart/form-data  →  field name: "resume"
 * Auth:     req.user._id  must be set by your auth middleware
 */
export const uploadResumeController = asyncHandler(async (req, res) => {
  // ── 1. Validate file presence ──────────────────────────────────────────
  if (!req.file) {
    return respond(res, {
      httpCode: 400,
      status: "error",
      message: "No file uploaded. Please attach a resume file.",
    });
  }

  const { path: tempPath, originalname, size, mimetype } = req.file;

  // ── 2. Validate file type ──────────────────────────────────────────────
  const allowedMimeTypes = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
  };

  const fileType = allowedMimeTypes[mimetype];

  if (!fileType) {
    return respond(res, {
      httpCode: 415,
      status: "error",
      message: "Unsupported file type. Only PDF, DOC, and DOCX are allowed.",
    });
  }

  // ── 3. Validate file size (5 MB cap) ──────────────────────────────────
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  if (size > MAX_SIZE_BYTES) {
    
    return respond(res, {
      httpCode: 413,
      status: "error",
      message: "File too large. Maximum allowed size is 5 MB.",
    });
  }

  // ── 4. Upload to Cloudinary ────────────────────────────────────────────
  let cloudinaryResult;
  try {
    cloudinaryResult = await uploadResume(tempPath, false, {
      public_id: `resume_${req.user._id}_${Date.now()}`,
      tags: ["resume", String(req.user._id)],
    });
  } catch (uploadError) {
    logger.error("❌ Cloudinary upload failed:", uploadError);
    
    return respond(res, {
      httpCode: 502,
      status: "internal_error",
      message: "Failed to upload file to storage. Please try again later.",
    });
  } finally {
    // Always remove the temp file regardless of outcome
    
  }

  // ── 5. Persist metadata to DB ──────────────────────────────────────────
  const upload = await Upload.create({
    userId: req.user._id,
    fileName: path.parse(originalname).name, // strip extension
    url: cloudinaryResult.url,
    publicId: cloudinaryResult.public_id,
    fileType,
    fileSize: size,
    processingStatus: "uploaded",
  });

  logger.info(`✅ Resume uploaded — uploadId: ${upload._id}, user: ${req.user._id}`);

  return respond(res, {
    httpCode: 201,
    status: "success",
    message: "Resume uploaded successfully.",
    data: {
      upload: {
        id: upload._id,
        fileName: upload.fileName,
        fileType: upload.fileType,
        fileSize: upload.fileSize,
        url: upload.url,
        processingStatus: upload.processingStatus,
        createdAt: upload.createdAt,
      },
    },
  });
});

// ─────────────────────────────────────────────

/**
 * GET /api/uploads
 * Fetch all (non-deleted) resumes for the authenticated user.
 * Supports:  ?page=1&limit=10
 */
export const getUserUploads = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id, isDeleted: false };

  const [uploads, total] = await Promise.all([
    Upload.find(filter)
      .select("-extractedText -__v") // exclude heavy / internal fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Upload.countDocuments(filter),
  ]);

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Uploads fetched successfully.",
    data: {
      uploads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    },
  });
});

// ─────────────────────────────────────────────

/**
 * GET /api/uploads/:id
 * Fetch a single upload by ID (must belong to the requesting user).
 */
export const getUploadById = asyncHandler(async (req, res) => {
  const upload = await Upload.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  })
    .select("-__v")
    .lean();

  if (!upload) {
    return respond(res, {
      httpCode: 404,
      status: "error",
      message: "Upload not found.",
    });
  }

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Upload fetched successfully.",
    data: { upload },
  });
});

// ─────────────────────────────────────────────

/**
 * DELETE /api/uploads/:id
 * Soft-delete an upload (sets isDeleted: true).
 * Hard-delete from Cloudinary is intentionally deferred to a background job.
 */
export const deleteUpload = asyncHandler(async (req, res) => {
  const upload = await Upload.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!upload) {
    return respond(res, {
      httpCode: 404,
      status: "error",
      message: "Upload not found.",
    });
  }

  upload.isDeleted = true;
  await upload.save();

  logger.info(`🗑️  Upload soft-deleted — id: ${upload._id}, user: ${req.user._id}`);

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Upload deleted successfully.",
    data: { deletedId: upload._id },
  });
});

// ─────────────────────────────────────────────

/**
 * PATCH /api/uploads/:id/analysis
 * Save AI analysis results against an upload document.
 *
 * Body: { score, atsScore, strengths, weaknesses, suggestions, skills }
 */
export const saveAnalysis = asyncHandler(async (req, res) => {
  const { score, atsScore, strengths, weaknesses, suggestions, skills } =
    req.body;

  // Basic validation
  const numericFields = { score, atsScore };
  for (const [key, val] of Object.entries(numericFields)) {
    if (val !== undefined && (typeof val !== "number" || val < 0 || val > 100)) {
      return respond(res, {
        httpCode: 400,
        status: "error",
        message: `${key} must be a number between 0 and 100.`,
      });
    }
  }

  const upload = await Upload.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!upload) {
    return respond(res, {
      httpCode: 404,
      status: "error",
      message: "Upload not found.",
    });
  }

  // Merge only the provided fields
  if (score !== undefined) upload.analysis.score = score;
  if (atsScore !== undefined) upload.analysis.atsScore = atsScore;
  if (Array.isArray(strengths)) upload.analysis.strengths = strengths;
  if (Array.isArray(weaknesses)) upload.analysis.weaknesses = weaknesses;
  if (Array.isArray(suggestions)) upload.analysis.suggestions = suggestions;
  if (Array.isArray(skills)) upload.analysis.skills = skills;

  upload.processingStatus = "completed";
  await upload.save();

  logger.info(`📊 Analysis saved — uploadId: ${upload._id}`);

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Analysis saved successfully.",
    data: { analysis: upload.analysis, processingStatus: upload.processingStatus },
  });
});

// ─────────────────────────────────────────────

/**
 * PATCH /api/uploads/:id/status
 * Update the processingStatus of an upload (internal / worker use).
 *
 * Body: { status: "processing" | "completed" | "failed" }
 */
export const updateProcessingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["uploaded", "processing", "completed", "failed"];

  if (!allowed.includes(status)) {
    return respond(res, {
      httpCode: 400,
      status: "error",
      message: `Invalid status. Allowed values: ${allowed.join(", ")}.`,
    });
  }

  const upload = await Upload.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, isDeleted: false },
    { processingStatus: status },
    { new: true, select: "_id processingStatus updatedAt" }
  );

  if (!upload) {
    return respond(res, {
      httpCode: 404,
      status: "error",
      message: "Upload not found.",
    });
  }

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Processing status updated.",
    data: { upload },
  });
});