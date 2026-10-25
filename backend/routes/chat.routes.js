import express from "express";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
  sendMessage,
} from "../controllers/chat.controller.js";
import { protect } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/rateLimit.js";
import {
  validateChatMessage,
  validateConversationCreate,
} from "../utils/validators.js";

const router = express.Router();

router.use(protect);

router.get("/conversations", listConversations);
router.post("/conversations", validateConversationCreate, createConversation);
router.get("/conversations/:id", getConversation);
router.patch("/conversations/:id", renameConversation);
router.delete("/conversations/:id", deleteConversation);
router.post(
  "/conversations/:id/messages",
  chatLimiter,
  validateChatMessage,
  sendMessage
);

export default router;
