import express from "express";
import {
  getActivity,
  getMyActivity,
} from "../controllers/github.controller.js";
import { protect } from "../middlewares/auth.js";
import { defaultLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.use(protect, defaultLimiter);

router.get("/activity", getActivity);
router.get("/me", getMyActivity);

export default router;
