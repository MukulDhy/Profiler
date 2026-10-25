import express from "express";
import {
  getPublicProfile,
  publicChat,
} from "../controllers/public.controller.js";
import { publicLimiter } from "../middlewares/rateLimit.js";
import { validatePublicChat } from "../utils/validators.js";

const router = express.Router();

router.get("/profile/:token", publicLimiter, getPublicProfile);
router.post("/profile/:token/chat", publicLimiter, validatePublicChat, publicChat);

export default router;
