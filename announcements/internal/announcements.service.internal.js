import mongoose from 'mongoose';
import { AnnouncementModel } from './announcement.model.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

export class AnnouncementsInternalService {
  static async createAnnouncement(data, user) {
    const { topic, description } = data;
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      throw new ValidationError('Topic is required.');
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('Description is required.');
    }

    const announcement = await AnnouncementModel.create({
      topic: topic.trim(),
      description: description.trim(),
      created_by: user.id,
    });

    return announcement.toJSON();
  }

  static async listAnnouncements({ page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [announcements, total] = await Promise.all([
      AnnouncementModel.find()
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum),
      AnnouncementModel.countDocuments(),
    ]);

    return {
      announcements: announcements.map((a) => a.toJSON()),
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    };
  }

  static async getAnnouncementById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid announcement ID format.');
    }

    const announcement = await AnnouncementModel.findById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }
    return announcement.toJSON();
  }

  static async updateAnnouncement(id, data, user) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid announcement ID format.');
    }

    const announcement = await AnnouncementModel.findById(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }

    if (data.topic !== undefined) {
      if (!data.topic || typeof data.topic !== 'string' || !data.topic.trim()) {
        throw new ValidationError('Topic cannot be empty.');
      }
      announcement.topic = data.topic.trim();
    }

    if (data.description !== undefined) {
      if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
        throw new ValidationError('Description cannot be empty.');
      }
      announcement.description = data.description.trim();
    }

    announcement.updated_by = user.id;

    await announcement.save();
    return announcement.toJSON();
  }

  static async deleteAnnouncement(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid announcement ID format.');
    }

    const announcement = await AnnouncementModel.findByIdAndDelete(id);
    if (!announcement) {
      throw new NotFoundError('Announcement not found.');
    }
    return { deleted: true, id };
  }
}