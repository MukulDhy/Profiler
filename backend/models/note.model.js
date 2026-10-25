import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Upload",
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, resumeId: 1, createdAt: -1 });

const Note = mongoose.model("Note", noteSchema);

export default Note;
