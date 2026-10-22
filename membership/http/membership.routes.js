import { Router } from 'express';
import * as controller from './membership.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  authorize,
} from '../../orchestration/http/middleware/auth.js';
import { uploadSingle } from '../../shared/middleware/uploadMiddleware.js';

const router = Router();

// Statistics (Public/Optional auth)
router.get('/stats', optionalAuthenticate, controller.getStats);

// Local Excel Import (Management - Protected)
router.post(
  '/import-local-sheet',
  authenticate,
  authorize('membership.import'),
  controller.importLocalSheet
);

// Bulk Import (Management - Protected)
router.post(
  '/bulk-import',
  authenticate,
  authorize('membership.import'),
  controller.bulkImportMemberships
);

// Sync from Forms API
router.get('/sync-status', optionalAuthenticate, controller.getSyncStatus);
router.post('/sync', optionalAuthenticate, controller.syncMemberships);
router.get('/sync', optionalAuthenticate, controller.syncMemberships);


// List and Create (Public student registration with optional auth)
router.get('/', optionalAuthenticate, controller.listMemberships);
router.post('/', optionalAuthenticate, uploadSingle('receipt_file'), controller.createMembership);

// Digital ID Card (Public - only verified members)
router.get('/id-card/:membershipNo', optionalAuthenticate, controller.getIdCard);
router.get('/id-card', optionalAuthenticate, controller.getIdCard);

// Resend Membership Verification Email with ID Card
router.post('/resend-email', optionalAuthenticate, controller.resendMembershipEmail);
router.post('/:id/resend-email', optionalAuthenticate, controller.resendMembershipEmail);

// Single Item Operations
router.get('/:id', optionalAuthenticate, controller.getMembershipById);
router.patch(
  '/:id/verify',
  authenticate,
  authorize('membership.verify'),
  controller.verifyMembership
);
router.put(
  '/:id',
  authenticate,
  authorize('membership.update'),
  controller.updateMembership
);
router.delete(
  '/:id',
  authenticate,
  authorize('membership.delete'),
  controller.deleteMembership
);
router.delete(
  '/',
  authenticate,
  authorize('membership.delete'),
  controller.deleteMembership
);

export default router;
