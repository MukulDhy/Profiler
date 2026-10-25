import { body, param, query, validationResult } from "express-validator";

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      data: null,
      message: "Validation failed",
      errorCode: 1001,
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

const strongPassword = (field = "password", label = "Password") =>
  body(field)
    .isLength({ min: 8, max: 72 })
    .withMessage(`${label} must be between 8 and 72 characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      `${label} must contain at least one uppercase letter, one lowercase letter, one number, and one special character`
    );

export const validateRegistration = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z][a-zA-Z\s.'-]*$/)
    .withMessage("Name can only contain letters, spaces, apostrophes, dots and hyphens"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email cannot exceed 100 characters"),

  strongPassword(),

  handleValidationErrors,
];

export const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

export const validateProfileUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z][a-zA-Z\s.'-]*$/)
    .withMessage("Name can only contain letters, spaces, apostrophes, dots and hyphens"),

  body("username")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage("Username can only contain letters, numbers, dots, hyphens and underscores"),

  body("location")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),

  body("bio")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Bio cannot exceed 500 characters"),

  body("phone")
    .optional({ values: "falsy" })
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage("Please provide a valid phone number"),

  body("profilePicture")
    .optional({ values: "falsy" })
    .matches(/^https?:\/\/[^\s]+$/)
    .withMessage("Please provide a valid image URL"),

  body("githubUsername")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 1, max: 39 })
    .withMessage("GitHub username must be between 1 and 39 characters")
    .matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/)
    .withMessage("Please provide a valid GitHub username"),

  handleValidationErrors,
];

export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  strongPassword("newPassword", "New password"),

  handleValidationErrors,
];

export const validateEmail = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  handleValidationErrors,
];

export const validatePasswordReset = [
  param("token").isLength({ min: 20 }).withMessage("Invalid reset token"),
  strongPassword(),
  handleValidationErrors,
];

export const validateGoogleAuth = [
  body("credential").notEmpty().withMessage("Google credential is required"),
  handleValidationErrors,
];

export const validateChatMessage = [
  body("content")
    .isString()
    .withMessage("Message content is required")
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage("Message must be between 1 and 4000 characters"),
  handleValidationErrors,
];

export const validateConversationCreate = [
  body("resumeId").isMongoId().withMessage("A valid resume id is required"),
  body("title")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Title cannot exceed 120 characters"),
  handleValidationErrors,
];

export const validateNote = [
  body("resumeId").isMongoId().withMessage("A valid resume id is required"),
  body("body")
    .isString()
    .withMessage("Note body is required")
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Note must be between 1 and 5000 characters"),
  body("conversationId")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid conversation id"),
  handleValidationErrors,
];

export const validateJobMatch = [
  body("resumeId").isMongoId().withMessage("A valid resume id is required"),
  body("jobDescription")
    .isString()
    .withMessage("Job description is required")
    .trim()
    .isLength({ min: 50, max: 20000 })
    .withMessage("Job description must be between 50 and 20,000 characters"),
  handleValidationErrors,
];

export const validatePublicChat = [
  body("question")
    .isString()
    .withMessage("A question is required")
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage("Question must be between 1 and 4,000 characters"),
  handleValidationErrors,
];

export const validatePagination = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  handleValidationErrors,
];
