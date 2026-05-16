import mongoose from "mongoose";
const { Schema } = mongoose;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    username: {
      type: String,
      trim: true,
      maxlength: [15, "username not exceed 100 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      validate: {
        validator: function (password) {
          // At least one uppercase, one lowercase, one number, one special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
            password
          );
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      },
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
      // match: [/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"],
    },

   
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (phone) {
          if (!phone) return true; // Optional field
          // Supports various international formats
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
          // Allow any valid https URL (Google photos, CDN links, etc.)
          return /^https?:\/\/[^\s]+$/.test(url);
        },
        message: "Please provide a valid image URL",
      },
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
    role: {
      type: String,
      required: true,
      default: "user",
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ skills: 1 });
userSchema.index({ experience: 1 });

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate password reset token (fixed)
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Instance method to generate JWT token (missing)
userSchema.methods.generateToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// Virtual for full profile completion percentage
userSchema.virtual("profileCompletion").get(function () {
  const fields = [
    "name",
    "email",
    "age",
    "phone",
    "profilePicture",
  ];
  const filledFields = fields.filter((field) => {
    if (field === "skills") return this[field] && this[field].length > 0;
    if (field === "profilePicture")
      return this[field] && this[field] !== "default-avatar.png";
    return this[field];
  });

  return Math.round((filledFields.length / fields.length) * 100);
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true });

const User = mongoose.model("User", userSchema);
export default User;
