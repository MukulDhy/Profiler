// Standardized response format
export const sendResponse = (
  res,
  statusCode,
  data = null,
  message = "",
  errorCode = 0
) => {
  res.status(statusCode).json({
    success: errorCode === 0,
    data,
    message,
    errorCode,
  });
  return;
};

// Standard error codes
export const ErrorCodes = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  INTERNAL_SERVER_ERROR: 2,
  NOT_FOUND: 3,
  UNAUTHORIZED: 4,
  FORBIDDEN: 5,
  DUPLICATE_ENTRY: 6,
  INVALID_CREDENTIALS: 7,
  TOKEN_EXPIRED: 8,
  TOKEN_INVALID: 9,
};
