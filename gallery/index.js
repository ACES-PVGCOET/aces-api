import {
  getUploadSignature,
  createGalleryItem,
  bulkCreateGalleryItems,
  getShowcase,
  getCollectionByName,
  listCollections,
  listGalleryItems,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
} from './internal/gallery.service.internal.js';

export const GalleryService = {
  getUploadSignature,
  createGalleryItem,
  bulkCreateGalleryItems,
  getShowcase,
  getCollectionByName,
  listCollections,
  listGalleryItems,
  getGalleryItemById,
  updateGalleryItem,
  deleteGalleryItem,
};
