import express from "express";
import { jobMatch } from "../controllers/ai.controller.js";
import { protect } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/rateLimit.js";
import { validateJobMatch } from "../utils/validators.js";

const router = express.Router();

router.use(protect);

router.post("/job-match", chatLimiter, validateJobMatch, jobMatch);

export default router;
