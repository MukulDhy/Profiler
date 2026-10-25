import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Upload from "../models/resume.model.js";
import { chatWithProfile } from "../services/aiAnalyser.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import logger from "../utils/logger.js";

const MAX_CONTEXT_MESSAGES = 14;

const assertObjectId = (value, label = "id") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${label}.`, 400, 1009);
  }
};

const loadResume = async (resumeId, userId) => {
  assertObjectId(resumeId, "resume id");
  const resume = await Upload.findOne({
    _id: resumeId,
    userId,
    isDeleted: false,
  }).select("fileName profile extractedText processingStatus");

  if (!resume) throw new AppError("Resume not found.", 404, 1004);
  if (resume.processingStatus !== "completed" || !resume.profile) {
    throw new AppError(
      "This resume has not finished analysing yet. Try again in a moment.",
      409,
      1003
    );
  }

  return resume;
};

const conversationSummary = (conversation) => {
  const messages = conversation.messages || [];
  const last = messages[messages.length - 1];

  return {
    id: conversation._id,
    title: conversation.title,
    resumeId: conversation.resumeId,
    messageCount: messages.length,
    lastMessage: last ? last.content.slice(0, 140) : "",
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const conversationPayload = (conversation) => ({
  id: conversation._id,
  title: conversation.title,
  resumeId: conversation.resumeId,
  messages: (conversation.messages || []).map((message) => ({
    id: message._id,
    role: message.role,
    content: message.content,
    provider: message.provider || null,
    model: message.model || null,
    createdAt: message.createdAt,
  })),
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

// ─── GET /api/chat/conversations ─────────────────────────────────────────────

export const listConversations = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id, isDeleted: false };
  if (req.query.resumeId) {
    assertObjectId(req.query.resumeId, "resume id");
    filter.resumeId = req.query.resumeId;
  }

  const conversations = await Conversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .select("title resumeId messages lastMessageAt createdAt updatedAt")
    .lean();

  return res.status(200).json({
    success: true,
    message: "Conversations fetched.",
    errorCode: 0,
    data: { conversations: conversations.map(conversationSummary) },
  });
});

// ─── POST /api/chat/conversations ────────────────────────────────────────────

export const createConversation = asyncHandler(async (req, res) => {
  const { resumeId, title } = req.body;
  await loadResume(resumeId, req.user._id);

  const conversation = await Conversation.create({
    userId: req.user._id,
    resumeId,
    title: title?.trim() || "New conversation",
  });

  return res.status(201).json({
    success: true,
    message: "Conversation created.",
    errorCode: 0,
    data: { conversation: conversationPayload(conversation) },
  });
});

// ─── GET /api/chat/conversations/:id ─────────────────────────────────────────

export const getConversation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "conversation id");

  const conversation = await Conversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!conversation) {
    throw new AppError("Conversation not found.", 404, 1004);
  }

  return res.status(200).json({
    success: true,
    message: "Conversation fetched.",
    errorCode: 0,
    data: { conversation: conversationPayload(conversation) },
  });
});

// ─── POST /api/chat/conversations/:id/messages ───────────────────────────────

export const sendMessage = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "conversation id");

  const conversation = await Conversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!conversation) {
    throw new AppError("Conversation not found.", 404, 1004);
  }

  const resume = await loadResume(conversation.resumeId, req.user._id);
  const content = String(req.body.content || "").trim();

  if (!content) {
    throw new AppError("Message content is required.", 400, 1009);
  }

  const history = conversation.messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content }));

  let result;
  try {
    result = await chatWithProfile({
      profile: resume.profile,
      extractedText: resume.extractedText,
      messages: history,
      question: content,
    });
  } catch (error) {
    logger.error(`Chat failed for conversation ${conversation._id}: ${error.message}`);
    throw new AppError(
      error.message || "The AI service could not answer right now.",
      502,
      2001
    );
  }

  conversation.messages.push({ role: "user", content });
  const assistantMessage = {
    role: "assistant",
    content: result.answer,
    provider: result.provider,
    model: result.model,
  };
  conversation.messages.push(assistantMessage);

  if (
    conversation.title === "New conversation" &&
    conversation.messages.filter((message) => message.role === "user").length === 1
  ) {
    conversation.title = content.slice(0, 80);
  }

  conversation.lastMessageAt = new Date();
  await conversation.save();

  const saved = conversation.messages[conversation.messages.length - 1];

  return res.status(200).json({
    success: true,
    message: "Answer generated.",
    errorCode: 0,
    data: {
      conversationId: conversation._id,
      message: {
        id: saved._id,
        role: "assistant",
        content: saved.content,
        provider: saved.provider || null,
        model: saved.model || null,
        createdAt: saved.createdAt,
      },
      suggestions: result.suggestions || [],
      title: conversation.title,
    },
  });
});

// ─── PATCH /api/chat/conversations/:id ───────────────────────────────────────

export const renameConversation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "conversation id");

  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, isDeleted: false },
    { title: String(req.body.title || "").trim().slice(0, 120) },
    { new: true }
  );

  if (!conversation) {
    throw new AppError("Conversation not found.", 404, 1004);
  }

  return res.status(200).json({
    success: true,
    message: "Conversation renamed.",
    errorCode: 0,
    data: { conversation: conversationSummary(conversation) },
  });
});

// ─── DELETE /api/chat/conversations/:id ──────────────────────────────────────

export const deleteConversation = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "conversation id");

  const conversation = await Conversation.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, isDeleted: false },
    { isDeleted: true },
    { new: true, select: "_id" }
  );

  if (!conversation) {
    throw new AppError("Conversation not found.", 404, 1004);
  }

  return res.status(200).json({
    success: true,
    message: "Conversation deleted.",
    errorCode: 0,
    data: { deletedId: conversation._id },
  });
});
