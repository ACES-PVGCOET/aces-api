import { uploadFile, deleteFile } from './cloudinary.js';
import { ValidationError } from '../errors/index.js';

/**
 * Extract raw file data (Buffer, path, or string) from an Express Multer req.file object or standard input
 * @param {object|Buffer|string} fileInput
 * @returns {Buffer|string}
 */
const extractFileData = (fileInput) => {
  if (!fileInput) return null;

  // Handle Express Multer file object
  if (typeof fileInput === 'object' && !Buffer.isBuffer(fileInput)) {
    if (fileInput.buffer) return fileInput.buffer;
    if (fileInput.path) return fileInput.path;
  }

  return fileInput;
};

/**
 * Process end-to-end upload of a single file to Cloudinary
 * 
 * @param {object|Buffer|string} fileInput - Express req.file object, Buffer, file path, or base64 string
 * @param {object} [options] - Upload options (folder, transformations, tags, etc.)
 * @returns {Promise<{ secureUrl: string, publicId: string, format: string, resourceType: string, bytes: number, width?: number, height?: number }>}
 */
export const processUploadedFile = async (fileInput, options = {}) => {
  const rawFile = extractFileData(fileInput);
  if (!rawFile) {
    throw new ValidationError('No file buffer or file path provided for upload.');
  }

  const uploadOptions = {
    folder: 'aces/uploads',
    resource_type: 'auto',
    ...options,
  };

  return await uploadFile(rawFile, uploadOptions);
};

/**
 * Shared utility for member profile photo uploads to Cloudinary
 * Handles folder structure and standard image optimizations automatically
 * 
 * @param {object|Buffer|string} fileInput - Express req.file object, Buffer, or path
 * @param {object} [options] - Additional Cloudinary upload options
 * @returns {Promise<{ secureUrl: string, publicId: string, format: string }>}
 */
export const uploadProfilePhoto = async (fileInput, options = {}) => {
  const photoOptions = {
    folder: 'aces/profile_photos',
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    ...options,
  };

  return await processUploadedFile(fileInput, photoOptions);
};

/**
 * Process uploading a new file while safely deleting the previous Cloudinary asset
 * 
 * @param {object|Buffer|string} newFileInput - Express req.file object, Buffer, or path
 * @param {string} [oldUrlOrPublicId] - Previous asset Cloudinary URL or public_id to cleanup
 * @param {object} [options] - Upload options for the new file
 * @returns {Promise<{ secureUrl: string, publicId: string }>}
 */
export const replaceUploadedFile = async (newFileInput, oldUrlOrPublicId, options = {}) => {
  // 1. Upload new file first
  const newUploadResult = await processUploadedFile(newFileInput, options);

  // 2. Safely cleanup old file if an old Cloudinary asset exists
  if (oldUrlOrPublicId && typeof oldUrlOrPublicId === 'string' && oldUrlOrPublicId.trim() !== '') {
    try {
      await deleteFile(oldUrlOrPublicId);
    } catch (err) {
      // Log warning without aborting successful upload
      console.warn(`Failed to cleanup previous Cloudinary asset '${oldUrlOrPublicId}':`, err.message);
    }
  }

  return newUploadResult;
};

export default {
  processUploadedFile,
  uploadProfilePhoto,
  replaceUploadedFile,
};
