import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 20000,
    },
    provider: String,
    model: String,
  },
  { _id: true, timestamps: true }
);

const conversationSchema = new mongoose.Schema(
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
    title: {
      type: String,
      default: "New conversation",
      trim: true,
      maxlength: 120,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, resumeId: 1, isDeleted: 1, lastMessageAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
