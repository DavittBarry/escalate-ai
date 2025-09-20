import { logger } from '../index.js';

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;
  
  if (!err.isOperational) {
    logger.error('Unexpected error:', err);
    message = 'Internal server error';
  } else {
    logger.warn(`Operational error: ${message}`, {
      statusCode,
      path: req.path,
      method: req.method
    });
  }
  
  res.status(statusCode).json({
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const validationErrorHandler = (errors) => {
  const message = errors.map(err => err.message).join(', ');
  return new AppError(message, 400);
};
