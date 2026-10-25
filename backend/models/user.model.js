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
      select: false, // ✅ exclude from queries by default
      validate: {
        validator: function (password) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
            password
          );
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      },
    },

    // Added userType field (was missing — caused test failures)
    // userType: {
    //   type: String,
    //   required: [true, "User type is required"],
    //   enum: {
    //     values: ["patient", "caregiver", "doctor"],
    //     message: "userType must be patient, caregiver, or doctor",
    //   },
    // },

    role: {
      type: String,
      required: true,
      default: "user",
    },

    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },

    username: {
      type: String,
      trim: true,
      maxlength: [15, "Username cannot exceed 15 characters"],
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

    profilePicture: {
      type: String,
      default:
        "https://static.vecteezy.com/system/resources/previews/054/078/735/non_2x/gamer-avatar-with-headphones-and-controller-vector.jpg",
      validate: {
        validator: function (url) {
          if (!url || url === "default-avatar.png") return true;
          return /^https?:\/\/[^\s]+$/.test(url);
        },
        message: "Please provide a valid image URL",
      },
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },

    resetPasswordToken: String,
    resetPasswordExpires: Date,
    refreshToken: String,
  },
  {
    timestamps: true,
    // Merged into one toJSON block — fixes the overwrite bug
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.refreshToken; 
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes
userSchema.index({ email: 1 });
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

// Compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Virtual: profile completion percentage
userSchema.virtual("profileCompletion").get(function () {
  const fields = ["name", "email", "phone", "profilePicture", "bio"];
  const filledFields = fields.filter((field) => {
    if (field === "profilePicture")
      return (
        this[field] &&
        this[field] !==
          "https://static.vecteezy.com/system/resources/previews/054/078/735/non_2x/gamer-avatar-with-headphones-and-controller-vector.jpg"
      );
    return !!this[field];
  });
  return Math.round((filledFields.length / fields.length) * 100);
});

const User = mongoose.model("User", userSchema);
export default User;