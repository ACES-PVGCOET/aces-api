import { AnnouncementModel } from './announcement.model.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

export class AnnouncementsInternalService {
  static async createAnnouncement(data, user) {
    const { topic, description } = data;
    if (!topic || !description) {
      throw new ValidationError('Topic and description are required.');
    }

    const announcement = await AnnouncementModel.create({
      topic,
      description,
      created_by: user.id,
    });

    return announcement.toJSON();
  }

  static async listAnnouncements() {
    const announcements = await AnnouncementModel.find().sort({ created_at: -1 });
    return announcements.map((a) => a.toJSON());
  }

  static async getAnnouncementById(id) {
    const announcement = await AnnouncementModel.findById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }
    return announcement.toJSON();
  }

  static async updateAnnouncement(id, data, user) {
    const announcement = await AnnouncementModel.findById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }

    if (data.topic !== undefined) announcement.topic = data.topic;
    if (data.description !== undefined) announcement.description = data.description;
    announcement.updated_by = user.id;

    await announcement.save();
    return announcement.toJSON();
  }

  static async deleteAnnouncement(id) {
    const announcement = await AnnouncementModel.findByIdAndDelete(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }
    return { deleted: true, id };
  }
}