import express from "express";
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "../controllers/note.controller.js";
import { protect } from "../middlewares/auth.js";
import { validateNote } from "../utils/validators.js";

const router = express.Router();

router.use(protect);

router.get("/", listNotes);
router.post("/", validateNote, createNote);
router.patch("/:id", updateNote);
router.delete("/:id", deleteNote);

export default router;
