import path from "path";
import Upload from "../models/resume.model.js";
import {
  downloadResumeToTemp,
  removeTempFile,
  resolveResumeFileType,
  uploadResume,
} from "../helpers/uploadResume.js";
import { analyzeResume, analyzeResumeText } from "../services/aiAnalyser.service.js";
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

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_BY_FILE_TYPE = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Runs the AI pipeline for an already-persisted upload. Intentionally
 * fire-and-forget: the HTTP response is sent before this starts.
 */
const runAnalysis = async ({ uploadId, filePath, text, fileName, mimeType }) => {
  try {
    logger.info(`🤖 Analysis started — uploadId: ${uploadId}`);

    const result = text
      ? await analyzeResumeText({ text, fileName })
      : await analyzeResume({ filePath, fileName, mimeType });

    const profile = result.profile || {};
    profile.candidate = profile.candidate || {};
    // Short human-friendly identifier for the dashboard header.
    profile.candidate.uuid = String(uploadId).slice(-8);

    const analysis = profile.analysis || {};
    const skillNames = Array.isArray(profile.skills)
      ? profile.skills.map((skill) => skill?.name).filter(Boolean)
      : [];

    const meta = result.meta || {};

    await Upload.findByIdAndUpdate(uploadId, {
      profile,
      extractedText: (result.extractedText || "").slice(0, 60_000),
      // Keep the legacy flattened fields in sync.
      "analysis.score": analysis.score ?? 0,
      "analysis.atsScore": analysis.atsScore ?? 0,
      "analysis.strengths": analysis.strengths ?? [],
      "analysis.weaknesses": analysis.weaknesses ?? [],
      "analysis.suggestions": analysis.suggestions ?? [],
      "analysis.skills": skillNames,
      analysisMeta: {
        provider: meta.provider || null,
        model: meta.model || null,
        durationMs: meta.durationMs || null,
        attempts: meta.attempts || 0,
        providerTrail: meta.providerTrail || [],
        warnings: meta.warnings || [],
        analysedAt: new Date(),
        error: null,
      },
      processingStatus: "completed",
    });

    logger.info(
      `✅ Analysis completed — uploadId: ${uploadId}, provider: ${meta.provider}`
    );
  } catch (error) {
    logger.error(
      `❌ Analysis failed — uploadId: ${uploadId}: ${error.message}`
    );

    await Upload.findByIdAndUpdate(uploadId, {
      processingStatus: "failed",
      analysisMeta: {
        analysedAt: new Date(),
        error: error.message,
      },
    }).catch((updateError) => {
      logger.error(
        `❌ Could not persist analysis failure for ${uploadId}: ${updateError.message}`
      );
    });
  } finally {
    await removeTempFile(filePath);
  }
};

// ─────────────────────────────────────────────

/**
 * POST /api/resume
 * Upload a resume file (pdf | docx), persist metadata, then analyse it in the
 * background. Responds immediately with processingStatus "processing".
 *
 * Expects:  multipart/form-data  →  field name: "resume"
 * Auth:     req.user._id  (set by auth middleware / demo mode)
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
  const fileType = resolveResumeFileType(mimetype, originalname);

  if (!fileType) {
    await removeTempFile(tempPath);
    return respond(res, {
      httpCode: 415,
      status: "error",
      message: "Unsupported file type. Only PDF and DOCX are allowed.",
    });
  }

  // ── 3. Validate file size (5 MB cap) ──────────────────────────────────
  if (size > MAX_SIZE_BYTES) {
    await removeTempFile(tempPath);
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
    await removeTempFile(tempPath);

    return respond(res, {
      httpCode: 502,
      status: "internal_error",
      message: "Failed to upload file to storage. Please try again later.",
    });
  }

  // ── 5. Persist metadata to DB ──────────────────────────────────────────
  let upload;
  try {
    upload = await Upload.create({
      userId: req.user._id,
      fileName: path.parse(originalname).name, // strip extension
      url: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      fileType,
      fileSize: size,
      processingStatus: "processing",
    });
  } catch (dbError) {
    await removeTempFile(tempPath);
    throw dbError;
  }

  logger.info(
    `📤 Resume uploaded — uploadId: ${upload._id}, user: ${req.user._id}`
  );

  // ── 6. Respond immediately, analyse in the background ──────────────────
  respond(res, {
    httpCode: 201,
    status: "success",
    message: "Resume uploaded. Analysis started.",
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

  setImmediate(() => {
    runAnalysis({
      uploadId: upload._id,
      filePath: tempPath,
      fileName: originalname,
      mimeType: MIME_BY_FILE_TYPE[fileType] || mimetype,
    }).catch((error) => {
      logger.error(`❌ Unhandled analysis error: ${error.message}`);
    });
  });
});

// ─────────────────────────────────────────────

/**
 * GET /api/resume
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
      .select("-extractedText -profile -__v") // exclude heavy fields
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

const profilePayload = (upload) => ({
  upload: {
    id: upload._id,
    fileName: upload.fileName,
    fileType: upload.fileType,
    fileSize: upload.fileSize,
    url: upload.url,
    createdAt: upload.createdAt,
    updatedAt: upload.updatedAt,
  },
  processingStatus: upload.processingStatus,
  profile: upload.profile || null,
  analysisMeta: upload.analysisMeta || null,
});

/**
 * GET /api/resume/latest/profile
 * Latest completed (or in-flight) analysis for the user. Used by the dashboard
 * when no explicit resume id is supplied.
 */
export const getLatestResumeProfile = asyncHandler(async (req, res) => {
  const baseFilter = { userId: req.user._id, isDeleted: false };

  const upload =
    (await Upload.findOne({
      ...baseFilter,
      processingStatus: "completed",
      profile: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .select("-extractedText -__v")
      .lean()) ||
    (await Upload.findOne(baseFilter)
      .sort({ createdAt: -1 })
      .select("-extractedText -__v")
      .lean());

  if (!upload) {
    return respond(res, {
      httpCode: 200,
      status: "success",
      message: "No resume analysed yet.",
      data: {
        upload: null,
        processingStatus: null,
        profile: null,
        analysisMeta: null,
      },
    });
  }

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Latest resume profile fetched successfully.",
    data: profilePayload(upload),
  });
});

// ─────────────────────────────────────────────

/**
 * GET /api/resume/:id/profile
 * Dashboard-ready payload for one upload (includes processingStatus so the
 * client can poll while the AI pipeline is running).
 */
export const getResumeProfile = asyncHandler(async (req, res) => {
  const upload = await Upload.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  })
    .select("-extractedText -__v")
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
    message: "Resume profile fetched successfully.",
    data: profilePayload(upload),
  });
});

// ─────────────────────────────────────────────

/**
 * POST /api/resume/:id/reanalyze
 * Re-run the AI pipeline for a stored resume.
 */
export const reanalyzeUpload = asyncHandler(async (req, res) => {
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

  if (upload.processingStatus === "processing") {
    return respond(res, {
      httpCode: 409,
      status: "error",
      message: "Analysis is already running for this resume.",
    });
  }

  // Prefer the text we already extracted: no storage download, no Docling re-run.
  const extractedText = (upload.extractedText || "").trim();
  let tempPath = null;

  if (extractedText.length < 50) {
    try {
      tempPath = await downloadResumeToTemp(
        upload.url,
        `${upload.fileName}.${upload.fileType}`
      );
    } catch (error) {
      logger.error(`❌ Re-analysis download failed: ${error.message}`);
      return respond(res, {
        httpCode: 502,
        status: "internal_error",
        message:
          "Could not retrieve the stored resume. Please upload the file again.",
      });
    }
  }

  upload.processingStatus = "processing";
  upload.analysisMeta = {
    error: null,
    analysedAt: upload.analysisMeta?.analysedAt,
  };
  await upload.save();

  respond(res, {
    httpCode: 202,
    status: "success",
    message: "Re-analysis started.",
    data: {
      upload: {
        id: upload._id,
        processingStatus: upload.processingStatus,
      },
    },
  });

  setImmediate(() => {
    runAnalysis({
      uploadId: upload._id,
      text: extractedText.length >= 50 ? extractedText : undefined,
      filePath: tempPath,
      fileName: `${upload.fileName}.${upload.fileType}`,
      mimeType: MIME_BY_FILE_TYPE[upload.fileType] || "application/pdf",
    }).catch((error) => {
      logger.error(`❌ Unhandled re-analysis error: ${error.message}`);
    });
  });
});

// ─────────────────────────────────────────────

/**
 * GET /api/resume/:id
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
 * DELETE /api/resume/:id
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

  logger.info(
    `🗑️  Upload soft-deleted — id: ${upload._id}, user: ${req.user._id}`
  );

  return respond(res, {
    httpCode: 200,
    status: "success",
    message: "Upload deleted successfully.",
    data: { deletedId: upload._id },
  });
});

// ─────────────────────────────────────────────

/**
 * PATCH /api/resume/:id/analysis
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
    data: {
      analysis: upload.analysis,
      processingStatus: upload.processingStatus,
    },
  });
});

// ─────────────────────────────────────────────

/**
 * PATCH /api/resume/:id/status
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
