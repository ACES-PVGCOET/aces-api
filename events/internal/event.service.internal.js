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

    const isHighlight = Boolean(data.isHighlight);
    if (isHighlight) {
      const count = await EventModel.countDocuments({ isHighlight: true });
      if (count >= 4) {
        throw new ValidationError('Maximum 4 events can be highlighted.');
      }
    }

    const reg_st_dt = data.reg_st_dt ? new Date(data.reg_st_dt) : null;
    if (reg_st_dt && isNaN(reg_st_dt.getTime())) {
      throw new ValidationError('Invalid registration start date.');
    }

    const reg_end_dt = data.reg_end_dt ? new Date(data.reg_end_dt) : null;
    if (reg_end_dt && isNaN(reg_end_dt.getTime())) {
      throw new ValidationError('Invalid registration end date.');
    }

    if (reg_st_dt && reg_end_dt && reg_end_dt < reg_st_dt) {
      throw new ValidationError('Registration end date cannot be earlier than start date.');
    }

    const now = new Date();

    const event = await EventModel.create({
      overview: data.overview,
      description: data.description,
      terms: data.terms,
      reg_form_id: data.reg_form_id || null,
      banner_url: data.banner_url || '',
      reg_st_dt,
      reg_end_dt,
      isHighlight,

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

  static async getHighlightedEvents() {
    const events = await EventModel.find({ isHighlight: true }).sort({
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

    if (data.isHighlight !== undefined) {
      const targetIsHighlight = Boolean(data.isHighlight);
      if (targetIsHighlight && !event.isHighlight) {
        const count = await EventModel.countDocuments({ isHighlight: true });
        if (count >= 4) {
          throw new ValidationError('Maximum 4 events can be highlighted.');
        }
      }
      event.isHighlight = targetIsHighlight;
    }

    if (data.reg_form_id === '' || data.reg_form_id === null) {
      event.reg_form_id = null;
    } else if (data.reg_form_id !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(data.reg_form_id)) {
        throw new ValidationError('Invalid registration form ID.');
      }
      event.reg_form_id = data.reg_form_id;
    }

    if (data.reg_st_dt === '' || data.reg_st_dt === null) {
      event.reg_st_dt = null;
    } else if (data.reg_st_dt !== undefined) {
      const d = new Date(data.reg_st_dt);
      if (isNaN(d.getTime())) {
        throw new ValidationError('Invalid registration start date.');
      }
      event.reg_st_dt = d;
    }

    if (data.reg_end_dt === '' || data.reg_end_dt === null) {
      event.reg_end_dt = null;
    } else if (data.reg_end_dt !== undefined) {
      const d = new Date(data.reg_end_dt);
      if (isNaN(d.getTime())) {
        throw new ValidationError('Invalid registration end date.');
      }
      event.reg_end_dt = d;
    }

    if (event.reg_st_dt && event.reg_end_dt && event.reg_end_dt < event.reg_st_dt) {
      throw new ValidationError('Registration end date cannot be earlier than start date.');
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