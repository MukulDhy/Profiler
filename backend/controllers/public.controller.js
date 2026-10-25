import Upload from "../models/resume.model.js";
import { chatWithProfile } from "../services/aiAnalyser.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import logger from "../utils/logger.js";

const findSharedUpload = async (token, { withText = false } = {}) => {
  const query = Upload.findOne({
    shareToken: token,
    isPublic: true,
    isDeleted: false,
  }).populate("userId", "name username bio profilePicture location githubUsername");

  if (!withText) {
    query.select("-extractedText");
  }

  const upload = await query;
  if (!upload) {
    throw new AppError("This profile link is invalid or has been revoked.", 404, 1004);
  }

  return upload;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const sanitiseProfile = (profile) => {
  if (!profile) return null;

  // Never expose the candidate's private contact details on a public link.
  const { email, phone, ...candidate } = profile.candidate || {};
  return { ...profile, candidate };
};

const redactContacts = (text, profile) => {
  if (!text) return "";

  const values = [profile?.candidate?.email, profile?.candidate?.phone]
    .filter((value) => typeof value === "string" && value.trim().length > 3)
    .sort((a, b) => b.length - a.length);

  let redacted = text;
  for (const value of values) {
    redacted = redacted.split(value).join("[redacted]");
  }

  // Catch any other address in the extracted resume text.
  return redacted.replace(EMAIL_PATTERN, "[redacted]");
};

const publicPayload = (upload) => {
  const user = upload.userId && typeof upload.userId === "object" ? upload.userId : null;

  return {
    profile: sanitiseProfile(upload.profile),
    owner: {
      name: user?.name || upload.profile?.candidate?.name || "Candidate",
      username: user?.username || null,
      bio: user?.bio || "",
      avatar: user?.profilePicture || "",
      location: user?.location || upload.profile?.candidate?.location || "",
      githubUsername: user?.githubUsername || null,
    },
    resume: {
      fileName: upload.fileName,
      fileType: upload.fileType,
      analysedAt: upload.analysisMeta?.analysedAt || upload.updatedAt,
    },
    sharedAt: upload.sharedAt,
  };
};

// ─── GET /api/public/profile/:token ──────────────────────────────────────────

export const getPublicProfile = asyncHandler(async (req, res) => {
  const upload = await findSharedUpload(req.params.token);

  if (upload.processingStatus !== "completed" || !upload.profile) {
    throw new AppError(
      "This profile is still being prepared. Please check back shortly.",
      409,
      1003
    );
  }

  return res.status(200).json({
    success: true,
    message: "Public profile fetched.",
    errorCode: 0,
    data: publicPayload(upload),
  });
});

// ─── POST /api/public/profile/:token/chat ────────────────────────────────────

export const publicChat = asyncHandler(async (req, res) => {
  const upload = await findSharedUpload(req.params.token, { withText: true });

  if (upload.processingStatus !== "completed" || !upload.profile) {
    throw new AppError("This profile is not ready yet.", 409, 1003);
  }

  const question = String(req.body.question || req.body.content || "").trim();
  if (!question) {
    throw new AppError("A question is required.", 400, 1009);
  }
  if (question.length > 4000) {
    throw new AppError("Questions must be 4,000 characters or fewer.", 400, 1009);
  }

  const messages = Array.isArray(req.body.messages)
    ? req.body.messages
        .filter(
          (message) =>
            message &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string"
        )
        .slice(-10)
        .map((message) => ({
          role: message.role,
          content: message.content.slice(0, 4000),
        }))
    : [];

  let result;
  try {
    result = await chatWithProfile({
      profile: sanitiseProfile(upload.profile),
      extractedText: redactContacts(upload.extractedText, upload.profile),
      messages,
      question,
    });
  } catch (error) {
    logger.error(`Public chat failed for ${req.params.token}: ${error.message}`);
    throw new AppError(
      "The AI assistant is unavailable right now. Please try again shortly.",
      502,
      2001
    );
  }

  return res.status(200).json({
    success: true,
    message: "Answer generated.",
    errorCode: 0,
    data: {
      answer: result.answer,
      suggestions: result.suggestions || [],
      provider: result.provider || null,
      model: result.model || null,
    },
  });
});
