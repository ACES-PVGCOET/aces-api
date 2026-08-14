import { GalleryService } from '../index.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

export const getUploadSignature = asyncHandler(async (req, res) => {
  const { folder, resource_type } = req.query;

  const data = GalleryService.getUploadSignature({ folder, resource_type });

  return sendSuccess(res, data);
});
