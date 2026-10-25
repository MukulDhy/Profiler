import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
      maxlength: [100, "Email cannot exceed 100 characters"],
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
      validate: {
        validator: function (password) {
          // Skipped for OAuth-only accounts, which get a generated password.
          if (this.provider === "google" && this.isNew && !password) return true;
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
            password
          );
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      },
    },

    username: {
      type: String,
      trim: true,
      maxlength: [30, "Username cannot exceed 30 characters"],
    },

    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (phone) {
          if (!phone) return true;
          return /^[\+]?[1-9][\d]{0,15}$/.test(
            phone.replace(/[\s\-\(\)\.]/g, "")
          );
        },
        message: "Please provide a valid phone number",
      },
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    profilePicture: {
      type: String,
      default: "",
      validate: {
        validator: function (url) {
          if (!url) return true;
          return /^https?:\/\/[^\s]+$/.test(url);
        },
        message: "Please provide a valid image URL",
      },
    },

    githubUsername: {
      type: String,
      trim: true,
      maxlength: [39, "GitHub username cannot exceed 39 characters"],
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      select: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: Date,

    refreshToken: {
      type: String,
      select: false,
    },

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    emailVerificationOtpHash: {
      type: String,
      select: false,
    },
    emailVerificationExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.emailVerificationOtpHash;
        delete ret.emailVerificationExpires;
        delete ret.googleId;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const saltRounds = process.env.NODE_ENV === "test" ? 4 : 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "15m" }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d" }
  );
};

userSchema.methods.hashRefreshToken = function (token) {
  return crypto.createHash("sha256").update(token).digest("hex");
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.methods.createEmailVerificationOtp = function () {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  this.emailVerificationOtpHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
  return otp;
};

userSchema.virtual("profileCompletion").get(function () {
  const fields = ["name", "email", "phone", "profilePicture", "bio"];
  const filled = fields.filter((field) => Boolean(this[field]));
  return Math.round((filled.length / fields.length) * 100);
});

const User = mongoose.model("User", userSchema);

export default User;
