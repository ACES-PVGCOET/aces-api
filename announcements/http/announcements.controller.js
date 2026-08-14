import { AnnouncementsInternalService } from '../internal/announcements.service.internal.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { ValidationError } from '../../shared/errors/index.js';

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { topic, description } = req.body;
  if (!topic || !description) {
    throw new ValidationError('Topic and description are required fields.');
  }

  const announcement = await AnnouncementsInternalService.createAnnouncement(req.body, req.user);
  return sendSuccess(res, announcement, 201);
});

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await AnnouncementsInternalService.listAnnouncements({ page, limit });
  return sendSuccess(res, result);
});

export const getAnnouncementById = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementsInternalService.getAnnouncementById(req.params.id);
  return sendSuccess(res, announcement);
});

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementsInternalService.updateAnnouncement(req.params.id, req.body, req.user);
  return sendSuccess(res, announcement);
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const result = await AnnouncementsInternalService.deleteAnnouncement(req.params.id);
  return sendSuccess(res, result);
});