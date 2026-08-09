import multer from 'multer';
import { ValidationError } from '../errors/index.js';

// Default configuration options
const DEFAULT_MAX_SIZE_MB = 5;
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Custom file filter factory for Multer
 * @param {Array<string>} allowedMimeTypes
 */
const createFileFilter = (allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES) => {
  return (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Invalid file type '${file.mimetype}'. Allowed types: ${allowedMimeTypes.join(', ')}`
        ),
        false
      );
    }
  };
};

/**
 * Configure standard Multer instance with memory storage
 * @param {object} [options]
 * @param {number} [options.maxSizeMB]
 * @param {Array<string>} [options.allowedMimeTypes]
 */
export const createMulterInstance = (options = {}) => {
  const maxSizeMB = options.maxSizeMB || DEFAULT_MAX_SIZE_MB;
  const allowedMimeTypes = options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES;

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
    fileFilter: createFileFilter(allowedMimeTypes),
  });
};

/**
 * Helper to handle Multer errors cleanly in Express middleware
 * @param {Function} multerMiddleware
 * @returns {Function} Express middleware function
 */
const handleMulterError = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ValidationError(`File size exceeds maximum limit of ${DEFAULT_MAX_SIZE_MB}MB.`));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new ValidationError(`Unexpected file field '${err.field}'.`));
          }
          return next(new ValidationError(`File upload error: ${err.message}`));
        }
        return next(err);
      }
      next();
    });
  };
};

/**
 * Middleware factory for single file upload
 * @param {string} fieldName - Form field name for file input
 * @param {object} [options] - Multer upload configuration options
 */
export const uploadSingle = (fieldName = 'profile_photo', options = {}) => {
  const upload = createMulterInstance(options);
  return handleMulterError(upload.single(fieldName));
};

/**
 * Middleware factory for multiple files upload under single field
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Max number of files
 * @param {object} [options] - Multer upload configuration options
 */
export const uploadArray = (fieldName = 'photos', maxCount = 5, options = {}) => {
  const upload = createMulterInstance(options);
  return handleMulterError(upload.array(fieldName, maxCount));
};

/**
 * Middleware factory for multi-field file uploads
 * @param {Array<{ name: string, maxCount?: number }>} fields - Field definitions
 * @param {object} [options] - Multer upload options
 */
export const uploadFields = (fields, options = {}) => {
  const upload = createMulterInstance(options);
  return handleMulterError(upload.fields(fields));
};

export default {
  createMulterInstance,
  uploadSingle,
  uploadArray,
  uploadFields,
};
