/**
 * Standardized Success Response Envelope
 */
export const sendSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
};

/**
 * Standardized Error Response Envelope
 */
export const sendError = (res, code = 'INTERNAL_ERROR', message = 'An unexpected error occurred', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  });
};
