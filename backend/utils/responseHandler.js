// utils/response.js

/**
 * Standard API Response Handler
 * Easy to use, clean, and production-ready
 */

export const ErrorCodes = {
  SUCCESS: 0,

  // Client Errors
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  DUPLICATE_ENTRY: 1005,
  INVALID_CREDENTIALS: 1006,
  TOKEN_EXPIRED: 1007,
  TOKEN_INVALID: 1008,
  BAD_REQUEST: 1009,

  // Server Errors
  INTERNAL_SERVER_ERROR: 2001,
};

/**
 * Main Response Sender
 */
const send = ({
  res,
  statusCode = 200,
  success = true,
  message = "",
  data = null,
  errorCode = ErrorCodes.SUCCESS,
  meta = null,
}) => {
  return res.status(statusCode).json({
    success,
    message,
    errorCode,
    data,
    ...(meta && { meta }),
  });
};

/**
 * Success Responses
 */
export const Response = {
  success: (res, data = null, message = "Success") =>
    send({
      res,
      statusCode: 200,
      success: true,
      message,
      data,
    }),

  created: (res, data = null, message = "Created successfully") =>
    send({
      res,
      statusCode: 201,
      success: true,
      message,
      data,
    }),

  updated: (res, data = null, message = "Updated successfully") =>
    send({
      res,
      statusCode: 200,
      success: true,
      message,
      data,
    }),

  deleted: (res, data = null, message = "Deleted successfully") =>
    send({
      res,
      statusCode: 200,
      success: true,
      message,
      data,
    }),

  /**
   * Error Responses
   */
  badRequest: (
    res,
    message = "Bad request",
    errorCode = ErrorCodes.BAD_REQUEST,
    data = null
  ) =>
    send({
      res,
      statusCode: 400,
      success: false,
      message,
      errorCode,
      data,
    }),

  unauthorized: (
    res,
    message = "Unauthorized",
    errorCode = ErrorCodes.UNAUTHORIZED
  ) =>
    send({
      res,
      statusCode: 401,
      success: false,
      message,
      errorCode,
    }),

  forbidden: (
    res,
    message = "Forbidden",
    errorCode = ErrorCodes.FORBIDDEN
  ) =>
    send({
      res,
      statusCode: 403,
      success: false,
      message,
      errorCode,
    }),

  notFound: (
    res,
    message = "Resource not found",
    errorCode = ErrorCodes.NOT_FOUND
  ) =>
    send({
      res,
      statusCode: 404,
      success: false,
      message,
      errorCode,
    }),

  conflict: (
    res,
    message = "Duplicate entry",
    errorCode = ErrorCodes.DUPLICATE_ENTRY
  ) =>
    send({
      res,
      statusCode: 409,
      success: false,
      message,
      errorCode,
    }),

  validationError: (
    res,
    message = "Validation failed",
    data = null,
    errorCode = ErrorCodes.VALIDATION_ERROR
  ) =>
    send({
      res,
      statusCode: 422,
      success: false,
      message,
      errorCode,
      data,
    }),

  serverError: (
    res,
    message = "Internal server error",
    errorCode = ErrorCodes.INTERNAL_SERVER_ERROR
  ) =>
    send({
      res,
      statusCode: 500,
      success: false,
      message,
      errorCode,
    }),
};

export default Response;