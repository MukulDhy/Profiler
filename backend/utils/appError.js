export class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400, 1);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, 3);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authorized") {
    super(message, 401, 4);
  }
}

// Add other specific error classes as needed
