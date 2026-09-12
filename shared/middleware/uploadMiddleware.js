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
 * @param {Array<string>|string|null} allowedMimeTypes
 */
const createFileFilter = (allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES) => {
  return (_req, file, cb) => {
    // If null/undefined or contains '*', accept all file types
    if (!allowedMimeTypes || allowedMimeTypes === '*' || (Array.isArray(allowedMimeTypes) && allowedMimeTypes.includes('*'))) {
      return cb(null, true);
    }

    const typesArray = Array.isArray(allowedMimeTypes) ? allowedMimeTypes : [allowedMimeTypes];
    const isAllowed = typesArray.some((type) => {
      if (type === file.mimetype) return true;
      if (typeof type === 'string' && type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        return file.mimetype.startsWith(prefix);
      }
      return false;
    });

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Invalid file type '${file.mimetype}'. Allowed types: ${typesArray.join(', ')}`
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
 * @param {Array<string>|string|null} [options.allowedMimeTypes]
 */
export const createMulterInstance = (options = {}) => {
  const maxSizeMB = options.maxSizeMB !== undefined ? options.maxSizeMB : DEFAULT_MAX_SIZE_MB;
  const allowedMimeTypes =
    options.allowedMimeTypes !== undefined
      ? options.allowedMimeTypes
      : DEFAULT_ALLOWED_MIME_TYPES;

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Math.round(maxSizeMB * 1024 * 1024),
    },
    fileFilter: createFileFilter(allowedMimeTypes),
  });
};

/**
 * Helper to handle Multer errors cleanly in Express middleware
 * @param {Function} multerMiddleware
 * @param {number} [maxSizeMB]
 * @returns {Function} Express middleware function
 */
const handleMulterError = (multerMiddleware, maxSizeMB = DEFAULT_MAX_SIZE_MB) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ValidationError(`File size exceeds maximum limit of ${maxSizeMB}MB.`));
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
  const maxSizeMB = options.maxSizeMB || DEFAULT_MAX_SIZE_MB;
  return handleMulterError(upload.single(fieldName), maxSizeMB);
};

/**
 * Middleware factory for multiple files upload under single field
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Max number of files
 * @param {object} [options] - Multer upload configuration options
 */
export const uploadArray = (fieldName = 'photos', maxCount = 5, options = {}) => {
  const upload = createMulterInstance(options);
  const maxSizeMB = options.maxSizeMB || DEFAULT_MAX_SIZE_MB;
  return handleMulterError(upload.array(fieldName, maxCount), maxSizeMB);
};

/**
 * Middleware factory for multi-field file uploads
 * @param {Array<{ name: string, maxCount?: number }>} fields - Field definitions
 * @param {object} [options] - Multer upload options
 */
export const uploadFields = (fields, options = {}) => {
  const upload = createMulterInstance(options);
  const maxSizeMB = options.maxSizeMB || DEFAULT_MAX_SIZE_MB;
  return handleMulterError(upload.fields(fields), maxSizeMB);
};

export default {
  createMulterInstance,
  uploadSingle,
  uploadArray,
  uploadFields,
};
