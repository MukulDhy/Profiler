import Upload from "../models/resume.model.js";
import { getGithubActivity } from "../services/github.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

const usernameFromUrl = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/github\.com\/([^/?#]+)/i);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-]+$/.test(text)) return text;
  return null;
};

const resolveUsernameFromProfile = async (userId) => {
  const resume = await Upload.findOne({
    userId,
    isDeleted: false,
    profile: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .select("profile")
    .lean();

  const profile = resume?.profile;
  if (!profile) return null;

  const fromLinks = usernameFromUrl(profile.candidate?.links?.github);
  if (fromLinks) return fromLinks;

  const platform = (profile.platforms || []).find((item) =>
    /github/i.test(item?.name || "")
  );
  return usernameFromUrl(platform?.handle);
};

// ─── GET /api/github/activity?username=... ───────────────────────────────────

export const getActivity = asyncHandler(async (req, res) => {
  const username = req.query.username;
  if (!username) {
    throw new AppError("A GitHub username is required.", 400, 1009);
  }

  const activity = await getGithubActivity(username);

  return res.status(200).json({
    success: true,
    message: "GitHub activity fetched.",
    errorCode: 0,
    data: { activity },
  });
});

// ─── GET /api/github/me ──────────────────────────────────────────────────────

export const getMyActivity = asyncHandler(async (req, res) => {
  const username =
    usernameFromUrl(req.user.githubUsername) ||
    (await resolveUsernameFromProfile(req.user._id));

  if (!username) {
    return res.status(200).json({
      success: true,
      message: "No GitHub username is connected yet.",
      errorCode: 0,
      data: { activity: null, username: null },
    });
  }

  const activity = await getGithubActivity(username);

  return res.status(200).json({
    success: true,
    message: "GitHub activity fetched.",
    errorCode: 0,
    data: { activity, username },
  });
});
