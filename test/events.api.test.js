import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';

describe('Events Module API Tests', () => {
  let adminToken;
  let eventTeamToken;
  let forbiddenToken;

  const ADMIN_ID = '66b64f9e1234567890000001';
  const EVENT_TEAM_ID = '66b64f9e1234567890000002';
  const FORBIDDEN_ID = '66b64f9e1234567890000003';
  const UPDATER_ID = '66b64f9e1234567890000004';
  const VALID_FORM_ID = '60d5ecb8b5c9c22b10a1d850';

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ id: ADMIN_ID, roles: ['admin'] });
    eventTeamToken = generateTestToken({ id: EVENT_TEAM_ID, roles: ['event_team'] });
    forbiddenToken = generateTestToken({ id: FORBIDDEN_ID, roles: ['marketing_team'] });
  });

  after(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/events (List Events)', () => {
    it('should return empty events list when database is empty', async () => {
      const res = await request('/api/v1/events');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.events, []);
    });

    it('should return list of events', async () => {
      await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Hackathon 2026',
          description: 'Annual hackathon event',
          terms: 'Open to all students',
        },
      });

      const res = await request('/api/v1/events');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.events.length, 1);
      assert.equal(res.body.data.events[0].overview, 'Hackathon 2026');
    });
  });

  describe('POST /api/v1/events (Create Event)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/events', {
        method: 'POST',
        body: {
          overview: 'Test Event',
          description: 'Description',
          terms: 'Terms',
        },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request from non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/events', {
        method: 'POST',
        token: forbiddenToken,
        body: {
          overview: 'Test Event',
          description: 'Description',
          terms: 'Terms',
        },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject missing overview, description, or terms with 400 Bad Request', async () => {
      const res = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          description: 'Missing overview and terms',
        },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject invalid reg_form_id with 400 Bad Request', async () => {
      const res = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Test Event',
          description: 'Description',
          terms: 'Terms',
          reg_form_id: 'invalid-form-id',
        },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should successfully create event for event_team role', async () => {
      const payload = {
        overview: 'Web Dev Workshop',
        description: 'Learn modern web development',
        terms: 'Bring your laptop',
        reg_form_id: VALID_FORM_ID,
        banner_url: 'https://res.cloudinary.com/aces/image/upload/v1/banner.jpg',
      };

      const res = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: payload,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.equal(res.body.data.overview, payload.overview);
      assert.equal(res.body.data.description, payload.description);
      assert.equal(res.body.data.terms, payload.terms);
      assert.equal(res.body.data.reg_form_id, VALID_FORM_ID);
      assert.equal(res.body.data.auditing.created_by, EVENT_TEAM_ID);
    });

    it('should successfully create event for admin role', async () => {
      const res = await request('/api/v1/events', {
        method: 'POST',
        token: adminToken,
        body: {
          overview: 'Admin Event',
          description: 'Admin Description',
          terms: 'Admin Terms',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
    });
  });

  describe('GET /api/v1/events/:id (Get Single Event)', () => {
    it('should return 400 Bad Request for malformed ObjectId format', async () => {
      const res = await request('/api/v1/events/invalid-object-id');
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return 404 Not Found for non-existent event ID', async () => {
      const nonExistentId = '66b64f9e1234567890999999';
      const res = await request(`/api/v1/events/${nonExistentId}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should return event details for valid existing ID', async () => {
      const createRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Target Event',
          description: 'Event Description',
          terms: 'Event Terms',
        },
      });

      const eventId = createRes.body.data.id;

      const res = await request(`/api/v1/events/${eventId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, eventId);
      assert.equal(res.body.data.overview, 'Target Event');
    });
  });

  describe('PUT /api/v1/events/:id (Update Event)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'PUT',
        body: { overview: 'Updated Overview' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'PUT',
        token: forbiddenToken,
        body: { overview: 'Updated Overview' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should return 400 Bad Request for invalid event ID format', async () => {
      const res = await request('/api/v1/events/bad-id', {
        method: 'PUT',
        token: eventTeamToken,
        body: { overview: 'Updated Overview' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return 404 Not Found for non-existent event ID', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'PUT',
        token: eventTeamToken,
        body: { overview: 'Updated Overview' },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should successfully update event fields and record updated_by', async () => {
      const createRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Old Overview',
          description: 'Old Description',
          terms: 'Old Terms',
          reg_form_id: VALID_FORM_ID,
        },
      });
      const eventId = createRes.body.data.id;

      const updaterToken = generateTestToken({ id: UPDATER_ID, roles: ['event_team'] });

      const res = await request(`/api/v1/events/${eventId}`, {
        method: 'PUT',
        token: updaterToken,
        body: {
          overview: 'New Overview',
          reg_form_id: '', // un-link form
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.overview, 'New Overview');
      assert.equal(res.body.data.reg_form_id, null);
      assert.equal(res.body.data.auditing.updated_by, UPDATER_ID);
    });
  });

  describe('DELETE /api/v1/events/:id (Delete Event)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'DELETE',
      });
      assert.equal(res.status, 401);
    });

    it('should reject non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'DELETE',
        token: forbiddenToken,
      });
      assert.equal(res.status, 403);
    });

    it('should return 400 Bad Request for malformed ID', async () => {
      const res = await request('/api/v1/events/invalid-id', {
        method: 'DELETE',
        token: eventTeamToken,
      });
      assert.equal(res.status, 400);
    });

    it('should return 404 Not Found for non-existent event', async () => {
      const res = await request('/api/v1/events/66b64f9e1234567890999999', {
        method: 'DELETE',
        token: eventTeamToken,
      });
      assert.equal(res.status, 404);
    });

    it('should successfully delete event and confirm removal via GET', async () => {
      const createRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'To Delete',
          description: 'Delete me',
          terms: 'Terms',
        },
      });
      const eventId = createRes.body.data.id;

      const deleteRes = await request(`/api/v1/events/${eventId}`, {
        method: 'DELETE',
        token: eventTeamToken,
      });

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.success, true);
      assert.equal(deleteRes.body.data.message, 'Event successfully removed.');

      const getRes = await request(`/api/v1/events/${eventId}`);
      assert.equal(getRes.status, 404);
    });
  });

  describe('GET /api/v1/events/highlights & Highlight Limits', () => {
    it('should return empty list when no events are highlighted', async () => {
      const res = await request('/api/v1/events/highlights');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.events, []);
    });

    it('should return only highlighted events', async () => {
      await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Normal Event',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: false,
        },
      });

      await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Highlighted Event',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: true,
        },
      });

      const res = await request('/api/v1/events/highlights');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.events.length, 1);
      assert.equal(res.body.data.events[0].overview, 'Highlighted Event');
      assert.equal(res.body.data.events[0].isHighlight, true);
    });

    it('should enforce limit of maximum 4 highlighted events on creation', async () => {
      for (let i = 1; i <= 4; i++) {
        const createRes = await request('/api/v1/events', {
          method: 'POST',
          token: eventTeamToken,
          body: {
            overview: `Highlight Event ${i}`,
            description: 'Desc',
            terms: 'Terms',
            isHighlight: true,
          },
        });
        assert.equal(createRes.status, 201);
      }

      // Attempting to create a 5th highlighted event should fail
      const res = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Highlight Event 5',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: true,
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.equal(res.body.error.message, 'Maximum 4 events can be highlighted.');
    });

    it('should enforce limit of maximum 4 highlighted events on update', async () => {
      for (let i = 1; i <= 4; i++) {
        await request('/api/v1/events', {
          method: 'POST',
          token: eventTeamToken,
          body: {
            overview: `Highlight Event ${i}`,
            description: 'Desc',
            terms: 'Terms',
            isHighlight: true,
          },
        });
      }

      const unhighlightedRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Unhighlighted Event',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: false,
        },
      });

      const eventId = unhighlightedRes.body.data.id;

      // Updating 5th event to isHighlight: true should fail
      const updateRes = await request(`/api/v1/events/${eventId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: {
          isHighlight: true,
        },
      });

      assert.equal(updateRes.status, 400);
      assert.equal(updateRes.body.success, false);
      assert.equal(updateRes.body.error.code, 'INVALID_INPUT');
      assert.equal(updateRes.body.error.message, 'Maximum 4 events can be highlighted.');
    });

    it('should allow updating an already highlighted event without hitting limit error', async () => {
      const createRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'Highlight Event',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: true,
        },
      });

      const eventId = createRes.body.data.id;

      // Fill remaining 3 slots
      for (let i = 2; i <= 4; i++) {
        await request('/api/v1/events', {
          method: 'POST',
          token: eventTeamToken,
          body: {
            overview: `Highlight Event ${i}`,
            description: 'Desc',
            terms: 'Terms',
            isHighlight: true,
          },
        });
      }

      // Update overview of existing highlighted event with isHighlight: true
      const updateRes = await request(`/api/v1/events/${eventId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: {
          overview: 'Updated Overview',
          isHighlight: true,
        },
      });

      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.overview, 'Updated Overview');
      assert.equal(updateRes.body.data.isHighlight, true);
    });

    it('should allow unhighlighting an event to free a slot', async () => {
      let firstHighlightedId;
      for (let i = 1; i <= 4; i++) {
        const createRes = await request('/api/v1/events', {
          method: 'POST',
          token: eventTeamToken,
          body: {
            overview: `Highlight Event ${i}`,
            description: 'Desc',
            terms: 'Terms',
            isHighlight: true,
          },
        });
        if (i === 1) firstHighlightedId = createRes.body.data.id;
      }

      // Unhighlight first event
      const unhighlightRes = await request(`/api/v1/events/${firstHighlightedId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: { isHighlight: false },
      });
      assert.equal(unhighlightRes.status, 200);
      assert.equal(unhighlightRes.body.data.isHighlight, false);

      // Now adding a 4th highlighted event (total highlighted will be 4 again) should succeed
      const newHighlightRes = await request('/api/v1/events', {
        method: 'POST',
        token: eventTeamToken,
        body: {
          overview: 'New 4th Highlighted Event',
          description: 'Desc',
          terms: 'Terms',
          isHighlight: true,
        },
      });
      assert.equal(newHighlightRes.status, 201);
      assert.equal(newHighlightRes.body.data.isHighlight, true);
    });
  });
});
