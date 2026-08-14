import { EventsService } from '../index.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { ValidationError } from '../../shared/errors/index.js';

export const createEvent = asyncHandler(async (req, res) => {
  const {
    overview,
    description,
    terms,
    reg_form_id,
    banner_url,
  } = req.body;

  if (!overview || !description || !terms) {
    throw new ValidationError(
      'Overview, description, and terms are required.',
    );
  }

  const event = await EventsService.createEvent({
    data: {
      overview,
      description,
      terms,
      reg_form_id,
      banner_url,
    },
    userId: req.user.id,
  });

  return sendSuccess(res, event, 201);
});

export const listEvents = asyncHandler(async (_req, res) => {
  const events = await EventsService.listEvents();

  return sendSuccess(res, { events });
});

export const getEventById = asyncHandler(async (req, res) => {
  const event = await EventsService.getEventById({
    id: req.params.id,
  });

  return sendSuccess(res, event);
});

export const updateEvent = asyncHandler(async (req, res) => {
  const event = await EventsService.updateEvent({
    id: req.params.id,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, event);
});

export const deleteEvent = asyncHandler(async (req, res) => {
  const result = await EventsService.deleteEvent({
    id: req.params.id,
  });

  return sendSuccess(res, result);
});