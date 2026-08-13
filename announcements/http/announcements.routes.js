import { Router } from 'express';
import * as announcementsController from './announcements.controller.js';
import { authenticate, authorize } from '../../orchestration/http/middleware/auth.js';

const router = Router();

router.get('/', announcementsController.listAnnouncements);
router.get('/:id', announcementsController.getAnnouncementById);

router.post('/', authenticate, authorize('announcements.create'), announcementsController.createAnnouncement);
router.put('/:id', authenticate, authorize('announcements.update'), announcementsController.updateAnnouncement);
router.delete('/:id', authenticate, authorize('announcements.delete'), announcementsController.deleteAnnouncement);

export default router;