import { AppError } from '../../../shared/errors/index.js';
import { sendError } from '../../../shared/utils/responseFormatter.js';
import { config } from '../../../shared/config/index.js';

export const errorHandlerMiddleware = (err, req, res, _next) => {
  if (config.env === 'development') {
    console.error(`[Error] Handler captured exception:`, err);
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 'INVALID_INPUT', `Invalid format for ${err.path}: ${err.value}`, 400);
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join(', ');
    return sendError(res, 'INVALID_INPUT', messages, 400);
  }

  // Handle Duplicate key error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, 'CONFLICT', `A record with this ${field} already exists.`, 409);
  }

  // Handle custom AppErrors
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.statusCode);
  }

  // Fallback for unhandled internal server errors
  return sendError(
    res,
    'INTERNAL_ERROR',
    config.env === 'production' ? 'An internal server error occurred.' : err.message,
    500
  );
};
