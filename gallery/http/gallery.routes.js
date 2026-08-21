import { Router } from 'express';
import * as galleryController from './gallery.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  authorize,
} from '../../orchestration/http/middleware/auth.js';

const router = Router();

// Presigned signature generation (Public / unauthenticated)
router.get(
  '/upload-signature',
  optionalAuthenticate,
  galleryController.getUploadSignature
);

// Public / Client read endpoints
router.get(
  '/showcase',
  optionalAuthenticate,
  galleryController.getShowcase
);

router.get(
  '/collections',
  optionalAuthenticate,
  galleryController.listCollections
);

router.get(
  '/collections/:collection_name',
  optionalAuthenticate,
  galleryController.getCollectionByName
);

router.get(
  '/items',
  optionalAuthenticate,
  galleryController.listGalleryItems
);

router.get(
  '/items/:id',
  optionalAuthenticate,
  galleryController.getGalleryItemById
);

// Protected endpoints for media_team / editorial_team / admin
router.post(
  '/items',
  authenticate,
  authorize('gallery.create'),
  galleryController.createGalleryItem
);

router.post(
  '/items/batch',
  authenticate,
  authorize('gallery.create'),
  galleryController.bulkCreateGalleryItems
);

router.put(
  '/items/:id',
  authenticate,
  authorize('gallery.update'),
  galleryController.updateGalleryItem
);

router.put(
  '/collections/:collection_name',
  authenticate,
  authorize('gallery.update'),
  galleryController.renameCollection
);

router.delete(
  '/items/:id',
  authenticate,
  authorize('gallery.delete'),
  galleryController.deleteGalleryItem
);

export default router;
