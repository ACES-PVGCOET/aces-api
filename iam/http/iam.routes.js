import { Router } from 'express';
import * as iamController from './iam.controller.js';
import { authenticate, optionalAuthenticate, authorize } from '../../orchestration/http/middleware/auth.js';
import { uploadSingle } from '../../shared/middleware/uploadMiddleware.js';

const router = Router();

// Public routes
router.post('/onboard', iamController.completeOnboarding);
router.post('/login', iamController.loginMember);
router.get('/members', optionalAuthenticate, iamController.listMembers);
router.get('/members/:id', optionalAuthenticate, iamController.getMemberById);

// Protected routes (Admin only via authority rules)
router.post('/register', authenticate, authorize('members.register'), uploadSingle('profile_photo'), iamController.registerMember);
router.post('/bulk-register', authenticate, authorize('members.register'), iamController.bulkRegisterMembers);
router.delete('/members/:id', authenticate, authorize('members.delete'), iamController.deleteMember);

// Protected routes (Member self or Admin)
router.put('/members/:id', authenticate, uploadSingle('profile_photo'), iamController.updateMember);

export default router;


