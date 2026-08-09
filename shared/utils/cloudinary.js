import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import { AppError, ValidationError } from '../errors/index.js';

/**
 * Configure Cloudinary with application settings and enforce secure HTTPS URLs
 */
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

/**
 * Helper to ensure Cloudinary credentials are set before executing requests
 */
const getCloudinaryCredentials = () => {
  const cloudName = config.cloudinary.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.cloudinary.apiKey || process.env.CLOUDINARY_API_KEY;
  const apiSecret = config.cloudinary.apiSecret || process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      'Cloudinary is not configured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET.',
      500,
      'CLOUDINARY_CONFIG_ERROR'
    );
  }

  // Ensure Cloudinary SDK is initialized with current credentials
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return { cloudName, apiKey, apiSecret };
};

/**
 * Extract public_id from a Cloudinary URL or return the public_id as is
 * @param {string} urlOrPublicId
 * @returns {string}
 */
export const extractPublicId = (urlOrPublicId) => {
  if (!urlOrPublicId || typeof urlOrPublicId !== 'string') return '';
  if (!urlOrPublicId.includes('/upload/')) return urlOrPublicId;

  const parts = urlOrPublicId.split(/\/upload\/(?:v\d+\/)?/);
  if (parts.length < 2) return urlOrPublicId;

  const publicIdWithExt = parts[1];
  const lastDotIndex = publicIdWithExt.lastIndexOf('.');
  if (lastDotIndex === -1) return publicIdWithExt;

  return publicIdWithExt.substring(0, lastDotIndex);
};

/**
 * Helper function to stream a Buffer or Readable Stream to Cloudinary
 * @param {Buffer|import('stream').Readable} bufferOrStream
 * @param {object} uploadOptions
 * @returns {Promise<object>}
 */
const uploadStreamToCloudinary = (bufferOrStream, uploadOptions) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(new AppError(`Cloudinary Upload Failed: ${error.message}`, 500, 'CLOUDINARY_UPLOAD_ERROR'));
      }
      resolve(result);
    });

    if (Buffer.isBuffer(bufferOrStream)) {
      stream.end(bufferOrStream);
    } else if (bufferOrStream && typeof bufferOrStream.pipe === 'function') {
      bufferOrStream.pipe(stream);
    } else {
      reject(new ValidationError('Invalid file input. Expected a Buffer or Readable Stream.'));
    }
  });
};

/**
 * Upload a file (File Path, Buffer, Stream, or Base64/Data URI) to Cloudinary
 * directly returning secure HTTPS URLs.
 * 
 * @param {string|Buffer|import('stream').Readable} fileInput - Path to local file, base64 string, URL, Buffer, or Stream
 * @param {object} [options] - Upload options (folder, public_id, resource_type, tags, etc.)
 * @returns {Promise<{ secureUrl: string, publicId: string, format: string, resourceType: string, bytes: number, width?: number, height?: number, cloudinaryResult: object }>}
 */
export const uploadFile = async (fileInput, options = {}) => {
  getCloudinaryCredentials();

  if (!fileInput) {
    throw new ValidationError('No file provided for upload.');
  }

  const uploadOptions = {
    resource_type: 'auto',
    ...options,
  };

  try {
    let result;

    if (typeof fileInput === 'string') {
      // Handles local file path, remote HTTP URL, or Base64 Data URI string
      result = await cloudinary.uploader.upload(fileInput, uploadOptions);
    } else if (Buffer.isBuffer(fileInput) || (fileInput && typeof fileInput.pipe === 'function')) {
      // Handles Buffer or Readable Stream
      result = await uploadStreamToCloudinary(fileInput, uploadOptions);
    } else {
      throw new ValidationError('Unsupported file input type. Provide a file path, base64 string, Buffer, or Stream.');
    }

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      cloudinaryResult: result,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to upload file to Cloudinary: ${error.message}`, 500, 'CLOUDINARY_UPLOAD_ERROR');
  }
};

/**
 * Upload multiple files to Cloudinary concurrently
 * 
 * @param {Array<string|Buffer|import('stream').Readable>} files - Array of file inputs
 * @param {object} [options] - Common upload options applied to each file
 * @returns {Promise<Array<{ secureUrl: string, publicId: string, format: string, resourceType: string, bytes: number, width?: number, height?: number, cloudinaryResult: object }>>}
 */
export const uploadMultipleFiles = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ValidationError('Files must be a non-empty array.');
  }

  const uploadPromises = files.map((file) => uploadFile(file, options));
  return Promise.all(uploadPromises);
};

/**
 * Delete a file from Cloudinary by public_id or Cloudinary URL
 * 
 * @param {string} urlOrPublicId - Asset public_id or full Cloudinary URL
 * @param {object} [options] - Delete options (resource_type, invalidate, etc.)
 * @returns {Promise<{ success: boolean, result: object }>}
 */
export const deleteFile = async (urlOrPublicId, options = {}) => {
  getCloudinaryCredentials();

  const publicId = extractPublicId(urlOrPublicId);
  if (!publicId) {
    throw new ValidationError('Invalid public_id or Cloudinary URL provided for deletion.');
  }

  const deleteOptions = {
    resource_type: 'image',
    invalidate: true,
    ...options,
  };

  try {
    const result = await cloudinary.uploader.destroy(publicId, deleteOptions);
    return {
      success: result.result === 'ok',
      result,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete file from Cloudinary: ${error.message}`, 500, 'CLOUDINARY_DELETE_ERROR');
  }
};

/**
 * Generate a signed payload for client-side direct uploads to Cloudinary
 * 
 * @param {object} [params] - Parameters to sign (e.g. folder, timestamp, upload_preset)
 * @returns {{ signature: string, timestamp: number, apiKey: string, cloudName: string, folder?: string, [key: string]: any }}
 */
export const generateUploadSignature = (params = {}) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureParams = {
    timestamp,
    ...params,
  };

  const signature = cloudinary.utils.api_sign_request(signatureParams, apiSecret);

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    ...signatureParams,
  };
};

export default {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  generateUploadSignature,
  extractPublicId,
};
