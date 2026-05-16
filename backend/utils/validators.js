import { body, validationResult } from "express-validator";

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errorCode: 1,
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

// Registration validation
export const validateRegistration = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email cannot exceed 100 characters"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("age")
    .optional()
    .isInt({ min: 13, max: 120 })
    .withMessage("Age must be between 13 and 120"),

  body("skills")
    .optional()
    .isArray({ max: 20 })
    .withMessage("Skills must be an array with maximum 20 items"),

  body("experience")
    .optional()
    .isIn(["beginner", "intermediate", "advanced"])
    .withMessage("Experience must be beginner, intermediate, or advanced"),

  body("github")
    .optional()
    .matches(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/?$/)
    .withMessage("Please provide a valid GitHub URL"),

  body("linkedin")
    .optional()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/)
    .withMessage("Please provide a valid LinkedIn URL"),

  body("phone")
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),

  handleValidationErrors,
];

// Login validation
export const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

// Profile update validation
export const validateProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("age")
    .optional()
    .isInt({ min: 13, max: 120 })
    .withMessage("Age must be between 13 and 120"),

  body("skills")
    .optional()
    .isArray({ max: 20 })
    .withMessage("Skills must be an array with maximum 20 items"),

  body("experience")
    .optional()
    .isIn(["beginner", "intermediate", "advanced"])
    .withMessage("Experience must be beginner, intermediate, or advanced"),

  body("github")
    .optional()
    .matches(/^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/?$/)
    .withMessage("Please provide a valid GitHub URL"),

  body("linkedin")
    .optional()
    .matches(/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/)
    .withMessage("Please provide a valid LinkedIn URL"),

  body("phone")
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),

  body("profilePicture")
    .optional()
    .matches(
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$|^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/i
    )
    .withMessage("Please provide a valid image URL or filename"),

  handleValidationErrors,
];

// Password change validation
export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  handleValidationErrors,
];

// Email validation
export const validateEmail = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  handleValidationErrors,
];

// Password reset validation
export const validatePasswordReset = [
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  handleValidationErrors,
];

// Google auth validation
export const validateGoogleAuth = [
  body("credential").notEmpty().withMessage("Google credential is required"),

  handleValidationErrors,
];
