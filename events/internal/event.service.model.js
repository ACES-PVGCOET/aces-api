import mongoose from 'mongoose';
import { EventModel } from './event.model.js';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';

export class EventInternalService {
  static async createEvent({ data, userId }) {
    if (!data.overview || !data.description || !data.terms) {
      throw new ValidationError(
        'Overview, description, and terms are required.',
      );
    }

    if (
      data.reg_form_id &&
      !mongoose.Types.ObjectId.isValid(data.reg_form_id)
    ) {
      throw new ValidationError('Invalid registration form ID.');
    }

    const now = new Date();

    const event = await EventModel.create({
      overview: data.overview,
      description: data.description,
      terms: data.terms,
      reg_form_id: data.reg_form_id || null,
      banner_url: data.banner_url || '',

      auditing: {
        created_by: userId,
        created_at: now,
        updated_by: userId,
        updated_at: now,
      },
    });

    return event.toJSON();
  }

  static async listEvents() {
    const events = await EventModel.find().sort({
      'auditing.created_at': -1,
    });

    return events.map((event) => event.toJSON());
  }

  static async getEventById({ id }) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID.');
    }

    const event = await EventModel.findById(id);

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' not found.`);
    }

    return event.toJSON();
  }

  static async updateEvent({ id, data, userId }) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID.');
    }

    const event = await EventModel.findById(id);

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' not found.`);
    }

    if (
      data.reg_form_id !== undefined &&
      data.reg_form_id !== null &&
      !mongoose.Types.ObjectId.isValid(data.reg_form_id)
    ) {
      throw new ValidationError('Invalid registration form ID.');
    }

    if (data.overview !== undefined) {
      event.overview = data.overview;
    }

    if (data.description !== undefined) {
      event.description = data.description;
    }

    if (data.terms !== undefined) {
      event.terms = data.terms;
    }

    if (data.reg_form_id !== undefined) {
      event.reg_form_id = data.reg_form_id;
    }

    if (data.banner_url !== undefined) {
      event.banner_url = data.banner_url;
    }

    event.auditing.updated_by = userId;
    event.auditing.updated_at = new Date();

    await event.save();

    return event.toJSON();
  }

  static async deleteEvent({ id }) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid event ID.');
    }

    const event = await EventModel.findByIdAndDelete(id);

    if (!event) {
      throw new NotFoundError(`Event with ID '${id}' not found.`);
    }

    return {
      message: 'Event successfully removed.',
    };
  }
}