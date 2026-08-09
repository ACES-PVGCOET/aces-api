/**
 * Wraps asynchronous controller route handlers to forward unhandled errors to Express error handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
