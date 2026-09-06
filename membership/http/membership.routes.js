import { Router } from 'express';
import * as controller from './membership.controller.js';
import { optionalAuthenticate } from '../../orchestration/http/middleware/auth.js';
import { uploadSingle } from '../../shared/middleware/uploadMiddleware.js';

const router = Router();

// Statistics
router.get('/stats', optionalAuthenticate, controller.getStats);

// Local Excel Import
router.post('/import-local-sheet', optionalAuthenticate, controller.importLocalSheet);

// Bulk Import
router.post('/bulk-import', optionalAuthenticate, controller.bulkImportMemberships);

// List and Create
router.get('/', optionalAuthenticate, controller.listMemberships);
router.post('/', optionalAuthenticate, uploadSingle('receipt_file'), controller.createMembership);

// Single Item Operations
router.get('/:id', optionalAuthenticate, controller.getMembershipById);
router.patch('/:id/verify', optionalAuthenticate, controller.verifyMembership);
router.put('/:id', optionalAuthenticate, controller.updateMembership);
router.delete('/:id', optionalAuthenticate, controller.deleteMembership);

export default router;
