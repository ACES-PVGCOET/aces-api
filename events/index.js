import { EventInternalService } from './internal/event.service.internal.js';

export const EventsService = {
  createEvent: (params) => EventInternalService.createEvent(params),

  listEvents: () => EventInternalService.listEvents(),

  getHighlightedEvents: () => EventInternalService.getHighlightedEvents(),

  getEventById: (params) => EventInternalService.getEventById(params),

  updateEvent: (params) => EventInternalService.updateEvent(params),

  deleteEvent: (params) => EventInternalService.deleteEvent(params),
};

export default EventsService;