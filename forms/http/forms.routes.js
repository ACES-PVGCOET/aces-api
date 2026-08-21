import express from 'express';
import {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  submitResponse,
  checkResponseExists,
  getFormResponses,
  getSingleResponse,
  uploadFormFile,
} from './forms.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  authorize,
} from '../../orchestration/http/middleware/auth.js';
import { uploadSingle } from '../../shared/middleware/uploadMiddleware.js';

const router = express.Router();

// Upload File for Form Response (Returns Cloudinary URL)
router.post('/upload', optionalAuthenticate, uploadSingle('file', { maxSizeMB: 10, allowedMimeTypes: null }), uploadFormFile);

// Form Creation (Requires forms.create authority)
router.post(
  '/',
  authenticate,
  authorize('forms.create'),
  createForm
);

// List All Forms (Public / Optional Auth)
router.get('/', optionalAuthenticate, getForms);

// Get Form Details & Questions
router.get('/:form_id', optionalAuthenticate, getFormById);

// Update Form
router.put(
  '/:form_id',
  authenticate,
  authorize('forms.update'),
  updateForm
);

// Delete Form
router.delete(
  '/:form_id',
  authenticate,
  authorize('forms.delete'),
  deleteForm
);

// Submit Response to Form
router.post('/:form_id/responses', optionalAuthenticate, submitResponse);

// Check if Response Exists for Email
router.get('/:form_id/responses/check', optionalAuthenticate, checkResponseExists);

// Get Responses for a Form
router.get(
  '/:form_id/responses',
  authenticate,
  authorize('forms.read_responses'),
  getFormResponses
);

// Get Single Response Detail
router.get(
  '/:form_id/responses/:response_id',
  authenticate,
  authorize('forms.read_responses'),
  getSingleResponse
);

export default router;
