import mongoose from "mongoose";
import Note from "../models/note.model.js";
import Upload from "../models/resume.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

const assertObjectId = (value, label = "id") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${label}.`, 400, 1009);
  }
};

const ensureResume = async (resumeId, userId) => {
  assertObjectId(resumeId, "resume id");
  const resume = await Upload.findOne({
    _id: resumeId,
    userId,
    isDeleted: false,
  }).select("_id");

  if (!resume) throw new AppError("Resume not found.", 404, 1004);
  return resume;
};

const notePayload = (note) => ({
  id: note._id,
  resumeId: note.resumeId,
  conversationId: note.conversationId || null,
  body: note.body,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});

// ─── GET /api/notes?resumeId=... ─────────────────────────────────────────────

export const listNotes = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };

  if (req.query.resumeId) {
    assertObjectId(req.query.resumeId, "resume id");
    filter.resumeId = req.query.resumeId;
  }

  const notes = await Note.find(filter).sort({ createdAt: -1 }).limit(100).lean();

  return res.status(200).json({
    success: true,
    message: "Notes fetched.",
    errorCode: 0,
    data: { notes: notes.map(notePayload) },
  });
});

// ─── POST /api/notes ─────────────────────────────────────────────────────────

export const createNote = asyncHandler(async (req, res) => {
  const { resumeId, conversationId, body } = req.body;
  await ensureResume(resumeId, req.user._id);

  if (conversationId) assertObjectId(conversationId, "conversation id");

  const note = await Note.create({
    userId: req.user._id,
    resumeId,
    conversationId: conversationId || null,
    body: String(body).trim(),
  });

  return res.status(201).json({
    success: true,
    message: "Note saved.",
    errorCode: 0,
    data: { note: notePayload(note) },
  });
});

// ─── PATCH /api/notes/:id ────────────────────────────────────────────────────

export const updateNote = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "note id");

  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { body: String(req.body.body || "").trim() },
    { new: true, runValidators: true }
  );

  if (!note) throw new AppError("Note not found.", 404, 1004);

  return res.status(200).json({
    success: true,
    message: "Note updated.",
    errorCode: 0,
    data: { note: notePayload(note) },
  });
});

// ─── DELETE /api/notes/:id ───────────────────────────────────────────────────

export const deleteNote = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "note id");

  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!note) throw new AppError("Note not found.", 404, 1004);

  return res.status(200).json({
    success: true,
    message: "Note deleted.",
    errorCode: 0,
    data: { deletedId: note._id },
  });
});
