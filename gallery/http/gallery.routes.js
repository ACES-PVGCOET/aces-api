import { Router } from 'express';
import { getUploadSignature } from './gallery.controller.js';
import { authenticate, authorize } from '../../orchestration/http/middleware/auth.js';

const router = Router();

router.get('/upload-signature', authenticate, authorize('gallery.upload'), getUploadSignature);

export default router;
