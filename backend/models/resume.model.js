import mongoose from "mongoose";

const analysisMetaSchema = new mongoose.Schema(
  {
    provider: String,
    model: String,
    durationMs: Number,
    attempts: { type: Number, default: 0 },
    providerTrail: [
      {
        _id: false,
        provider: String,
        model: String,
        status: String,
        error: String,
      },
    ],
    warnings: [String],
    analysedAt: Date,
    error: { type: String, default: null },
  },
  { _id: false }
);

const uploadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
      maxlength: [255, "File name cannot exceed 255 characters"],
    },

    url: {
      type: String,
      required: [true, "Resume URL is required"],
      trim: true,
      maxlength: [2048, "URL cannot exceed 2048 characters"],
    },

    publicId: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      enum: ["pdf", "doc", "docx"],
      required: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    extractedText: {
      type: String,
      default: "",
    },

    /**
     * Full dashboard-ready payload produced by the AI Analyser.
     * Shape: { candidate, analysis, skills, radarSkills, timeline, projects,
     *          platforms, recruiterInsights, codingActivity }
     */
    profile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /**
     * Diagnostic metadata about the analysis run (which provider/model was
     * used, how long it took, fallback attempts and any error).
     */
    analysisMeta: {
      type: analysisMetaSchema,
      default: () => ({}),
    },

    // Legacy flattened analysis (kept in sync for existing consumers).
    analysis: {
      score: {
        type: Number,
        default: 0,
      },

      atsScore: {
        type: Number,
        default: 0,
      },

      strengths: [String],

      weaknesses: [String],

      suggestions: [String],

      skills: [String],
    },

    processingStatus: {
      type: String,
      enum: ["uploaded", "processing", "completed", "failed"],
      default: "uploaded",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index
uploadSchema.index({ userId: 1, createdAt: -1 });
uploadSchema.index({ userId: 1, processingStatus: 1, createdAt: -1 });

const Upload = mongoose.model("Upload", uploadSchema);

export default Upload;
