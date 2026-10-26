import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import axios from "axios";
import logger from "../utils/logger.js";
import { DATA_DIR, ensureDirs } from "../config/runtimeConfig.js";
import "../config/env.js";
import {
  deleteLocalFile,
  isLocalStorage,
  localPathForUrl,
  saveLocalFile,
} from "./storage.js";


// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary (hosted deployments only)
// ─────────────────────────────────────────────────────────────────────────────

export const configCloudinary = () => {
  if (isLocalStorage()) {
    logger.info("📁 File storage: local disk (Cloudinary disabled)");
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  logger.info("✅ Cloudinary configured");
};

// ─────────────────────────────────────────────────────────────────────────────
// Multer — resume upload (PDF / DOCX, 5 MB)
// ─────────────────────────────────────────────────────────────────────────────

/** Temporary staging folder; files are moved to permanent storage afterwards. */
const UPLOAD_DIR = path.join(DATA_DIR, "tmp");
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RESUME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

/**
 * Resolve the stored file type. Some browsers/OSes send DOCX (or even PDF) as
 * `application/octet-stream`, so fall back to the extension.
 */
export const resolveResumeFileType = (mimetype, originalname = "") => {
  const byMime = ALLOWED_RESUME_TYPES[mimetype];
  if (byMime) return byMime;

  const ext = path.extname(originalname).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  return null;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirs();
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `resume_${unique}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.has(ext) ||
      !resolveResumeFileType(file.mimetype, file.originalname)
    ) {
      return cb(
        new Error("Unsupported file type. Only PDF and DOCX are allowed.")
      );
    }
    cb(null, true);
  },
});

/**
 * Wraps multer so its errors become the standard JSON envelope instead of
 * falling through to the generic 500 handler.
 */
export const uploadSingleResume = (req, res, next) => {
  upload.single("resume")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        status: "error",
        message: "File too large. Maximum allowed size is 5 MB.",
        data: {},
      });
    }

    return res.status(400).json({
      status: "error",
      message: err.message || "Resume upload failed.",
      data: {},
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a resume file.
 *
 * Local mode moves the file into `<data home>/data/uploads/resumes` and returns
 * a `/uploads/...` URL. Cloudinary mode keeps the original behaviour.
 */
export const uploadResume = async (
  filePath,
  uploadLocal = false,
  options = {}
) => {
  if (isLocalStorage()) {
    const baseName =
      options.public_id || `resume_${Date.now()}_${path.parse(filePath).name}`;
    const stored = await saveLocalFile(filePath, {
      folder: "resumes",
      baseName,
      ext: path.extname(filePath),
    });
    return stored;
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "Resumes",
      resource_type: "raw", // better for pdf/docx
      ...options,
    });

    return {
      url: result.secure_url,
      public_id: result.public_id,
      original_filename: result.original_filename,
      storage: "cloudinary",
    };
  } catch (error) {
    logger.error("❌ Error uploading resume to Cloudinary:", error);

    throw new Error("Failed to upload resume to Cloudinary");
  }
};

/** Remove a stored resume (used when an upload is deleted). */
export const deleteStoredResume = async (publicId) => {
  if (!publicId) return;
  if (isLocalStorage()) {
    await deleteLocalFile(publicId);
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (error) {
    logger.warn(`Could not delete ${publicId} from Cloudinary: ${error.message}`);
  }
};

/**
 * Copy a previously uploaded resume into the local temp directory (used by the
 * re-analyse endpoint). Understands both `/uploads/...` local URLs and remote
 * (Cloudinary) URLs.
 */
export const downloadResumeToTemp = async (url, fileName = "resume.pdf") => {
  ensureDirs();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(fileName) || ".pdf";
  const destination = path.join(
    UPLOAD_DIR,
    `reanalyze_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
  );

  const localPath = localPathForUrl(url);
  if (localPath) {
    await fs.promises.copyFile(localPath, destination);
    return destination;
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60_000,
    maxContentLength: MAX_SIZE_BYTES,
  });

  await fs.promises.writeFile(destination, Buffer.from(response.data));
  return destination;
};

export const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Best effort — the file may already be gone.
  }
};
