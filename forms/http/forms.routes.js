import express from 'express';
import {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  submitResponse,
  getFormResponses,
  getSingleResponse,
} from './forms.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  requireRoles,
} from '../../orchestration/http/middleware/auth.js';

const router = express.Router();

// Form Creation (Requires editorial_team, event_team, or admin)
router.post(
  '/',
  authenticate,
  requireRoles('editorial_team', 'event_team', 'admin'),
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
  requireRoles('editorial_team', 'event_team', 'admin'),
  updateForm
);

// Delete Form
router.delete(
  '/:form_id',
  authenticate,
  requireRoles('editorial_team', 'event_team', 'admin'),
  deleteForm
);

// Submit Response to Form
router.post('/:form_id/responses', optionalAuthenticate, submitResponse);

// Get Responses for a Form
router.get(
  '/:form_id/responses',
  authenticate,
  requireRoles('editorial_team', 'event_team', 'admin'),
  getFormResponses
);

// Get Single Response Detail
router.get(
  '/:form_id/responses/:response_id',
  authenticate,
  requireRoles('editorial_team', 'event_team', 'admin'),
  getSingleResponse
);

export default router;
