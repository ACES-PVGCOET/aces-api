import { AnnouncementsInternalService } from './internal/announcements.service.internal.js';

export const AnnouncementsService = {
  createAnnouncement: (data, user) => AnnouncementsInternalService.createAnnouncement(data, user),
  listAnnouncements: () => AnnouncementsInternalService.listAnnouncements(),
  getAnnouncementById: (id) => AnnouncementsInternalService.getAnnouncementById(id),
  updateAnnouncement: (id, data, user) => AnnouncementsInternalService.updateAnnouncement(id, data, user),
  deleteAnnouncement: (id) => AnnouncementsInternalService.deleteAnnouncement(id),
};

export default AnnouncementsService;