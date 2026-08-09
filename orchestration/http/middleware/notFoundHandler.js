import { sendError } from '../../../shared/utils/responseFormatter.js';

export const notFoundHandlerMiddleware = (req, res) => {
  return sendError(res, 'NOT_FOUND', `Cannot ${req.method} ${req.originalUrl}`, 404);
};
