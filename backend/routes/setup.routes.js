import express from "express";
import {
  completeSetup,
  getSetupStatus,
  testMongo,
  updateLlm,
} from "../controllers/setup.controller.js";

const router = express.Router();

router.get("/status", getSetupStatus);
router.post("/test-mongo", testMongo);
router.post("/config", completeSetup);
router.post("/llm", updateLlm);

export default router;
