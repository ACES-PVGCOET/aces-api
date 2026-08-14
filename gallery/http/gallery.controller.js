import { GalleryService } from '../index.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

export const getUploadSignature = asyncHandler(async (req, res) => {
  const { folder, resource_type } = req.query;

  const data = GalleryService.getUploadSignature({ folder, resource_type });

  return sendSuccess(res, data);
});

export const createGalleryItem = asyncHandler(async (req, res) => {
  const item = await GalleryService.createGalleryItem({
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, item, 201);
});

export const bulkCreateGalleryItems = asyncHandler(async (req, res) => {
  const { collection_name, items } = req.body;

  const createdItems = await GalleryService.bulkCreateGalleryItems({
    collection_name,
    items,
    userId: req.user.id,
  });

  return sendSuccess(
    res,
    {
      collection_name,
      count: createdItems.length,
      items: createdItems,
    },
    201
  );
});

export const getShowcase = asyncHandler(async (_req, res) => {
  const showcase = await GalleryService.getShowcase();

  return sendSuccess(res, showcase);
});

export const getCollectionByName = asyncHandler(async (req, res) => {
  const collection = await GalleryService.getCollectionByName({
    collection_name: req.params.collection_name,
  });

  return sendSuccess(res, collection);
});

export const listCollections = asyncHandler(async (_req, res) => {
  const result = await GalleryService.listCollections();

  return sendSuccess(res, result);
});

export const listGalleryItems = asyncHandler(async (req, res) => {
  const items = await GalleryService.listGalleryItems(req.query);

  return sendSuccess(res, { items });
});

export const getGalleryItemById = asyncHandler(async (req, res) => {
  const item = await GalleryService.getGalleryItemById({
    id: req.params.id,
  });

  return sendSuccess(res, item);
});

export const updateGalleryItem = asyncHandler(async (req, res) => {
  const updatedItem = await GalleryService.updateGalleryItem({
    id: req.params.id,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, updatedItem);
});

export const deleteGalleryItem = asyncHandler(async (req, res) => {
  const result = await GalleryService.deleteGalleryItem({
    id: req.params.id,
  });

  return sendSuccess(res, result);
});
