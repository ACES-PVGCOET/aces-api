import { generateUploadSignature } from '../../shared/utils/cloudinary.js';
import { ValidationError } from '../../shared/errors/index.js';

export const getUploadSignature = ({ folder, resource_type }) => {
  if (!folder || !resource_type) {
    throw new ValidationError('folder and resource_type are required query parameters.');
  }

  const signed = generateUploadSignature({ folder });

  return {
    upload_url: `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resource_type}/upload`,
    signature: signed.signature,
    timestamp: signed.timestamp,
    api_key: signed.apiKey,
  };
};
