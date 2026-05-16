import { ErrorCodes } from "../utils/responseHandler.js";
import logger from "../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  logger.error(`${err.name}: ${err.message}`);
  logger.debug(err.stack);

  let error = { ...err };
  error.message = err.message;
  error.errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    error.message = "Resource not found";
    error.statusCode = 404;
    error.errorCode = ErrorCodes.NOT_FOUND;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `Duplicate field value entered: ${field}`;
    error.statusCode = 400;
    error.errorCode = ErrorCodes.DUPLICATE_ENTRY;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error.message = message;
    error.statusCode = 400;
    error.errorCode = ErrorCodes.VALIDATION_ERROR;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error.message = "Invalid token";
    error.statusCode = 401;
    error.errorCode = ErrorCodes.TOKEN_INVALID;
  }

  if (err.name === "TokenExpiredError") {
    error.message = "Token expired";
    error.statusCode = 401;
    error.errorCode = ErrorCodes.TOKEN_EXPIRED;
  }

  // Send standardized error response
  res.status(error.statusCode || 500).json({
    success: false,
    data: null,
    message: error.message || "Server Error",
    errorCode: error.errorCode || ErrorCodes.INTERNAL_SERVER_ERROR,
  });
};

export default errorHandler;
