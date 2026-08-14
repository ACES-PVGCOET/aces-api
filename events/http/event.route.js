import { Router } from 'express';
import * as eventController from './event.controller.js';
import {
  authenticate,
  optionalAuthenticate,
  authorize,
} from '../../orchestration/http/middleware/auth.js';

const router = Router();

// Public/member-readable routes
router.get(
  '/',
  optionalAuthenticate,
  eventController.listEvents,
);

router.get(
  '/highlights',
  optionalAuthenticate,
  eventController.getHighlightedEvents,
);

router.get(
  '/:id',
  optionalAuthenticate,
  eventController.getEventById,
);

// event_team protected routes
router.post(
  '/',
  authenticate,
  authorize('events.create'),
  eventController.createEvent,
);

router.put(
  '/:id',
  authenticate,
  authorize('events.update'),
  eventController.updateEvent,
);

router.delete(
  '/:id',
  authenticate,
  authorize('events.delete'),
  eventController.deleteEvent,
);

export default router;