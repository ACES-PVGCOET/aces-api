import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';

describe('Announcements Module API Tests', () => {
  let adminToken;
  let marketingToken;
  let forbiddenToken;

  const ADMIN_ID = '66b64f9e1234567890000001';
  const MARKETING_ID = '66b64f9e1234567890000002';
  const FORBIDDEN_ID = '66b64f9e1234567890000003';
  const UPDATER_ID = '66b64f9e1234567890000004';

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ id: ADMIN_ID, roles: ['admin'] });
    marketingToken = generateTestToken({ id: MARKETING_ID, roles: ['marketing_team'] });
    forbiddenToken = generateTestToken({ id: FORBIDDEN_ID, roles: ['event_team'] });
  });

  after(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/announcements (List Announcements)', () => {
    it('should return empty announcements list when database is empty', async () => {
      const res = await request('/api/v1/announcements');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.announcements, []);
      assert.equal(res.body.data.total, 0);
      assert.equal(res.body.data.page, 1);
      assert.equal(res.body.data.limit, 10);
      assert.equal(res.body.data.total_pages, 0);
    });

    it('should return paginated list of announcements sorted by creation date (descending)', async () => {
      await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Announcement 1', description: 'First announcement' },
      });
      await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Announcement 2', description: 'Second announcement' },
      });
      await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Announcement 3', description: 'Third announcement' },
      });

      const res = await request('/api/v1/announcements?page=1&limit=2');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.announcements.length, 2);
      assert.equal(res.body.data.announcements[0].topic, 'Announcement 3');
      assert.equal(res.body.data.total, 3);
      assert.equal(res.body.data.total_pages, 2);
    });
  });

  describe('POST /api/v1/announcements (Create Announcement)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        body: { topic: 'Test', description: 'Test description' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request with invalid JWT token with 401 Unauthorized', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: 'invalid.jwt.token',
        body: { topic: 'Test', description: 'Test description' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request from non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: forbiddenToken,
        body: { topic: 'Test', description: 'Test description' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject missing topic with 400 Bad Request', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { description: 'Missing topic' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject whitespace-only topic with 400 Bad Request', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: '   ', description: 'Whitespace topic' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject missing description with 400 Bad Request', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Missing description' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should successfully create announcement for marketing_team role', async () => {
      const payload = {
        topic: 'Hackathon Registration Open',
        description: 'Register now for the 2026 ACES Hackathon!',
      };

      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: payload,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.equal(res.body.data.topic, payload.topic);
      assert.equal(res.body.data.description, payload.description);
      assert.equal(res.body.data.created_by, MARKETING_ID);
      assert.equal(res.body.data.updated_by, null);
    });

    it('should successfully create announcement for admin role', async () => {
      const res = await request('/api/v1/announcements', {
        method: 'POST',
        token: adminToken,
        body: { topic: 'System Update', description: 'Maintenance tonight at 11 PM' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
    });
  });

  describe('GET /api/v1/announcements/:id (Get Single Announcement)', () => {
    it('should return 400 Bad Request for malformed ObjectId format', async () => {
      const res = await request('/api/v1/announcements/invalid-object-id');
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return 404 Not Found for non-existent announcement ID', async () => {
      const nonExistentId = '66b64f9e1234567890999999';
      const res = await request(`/api/v1/announcements/${nonExistentId}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should return announcement details for valid existing ID', async () => {
      const createRes = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Target Announcement', description: 'Details here' },
      });

      const anncId = createRes.body.data.id;

      const res = await request(`/api/v1/announcements/${anncId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.id, anncId);
      assert.equal(res.body.data.topic, 'Target Announcement');
      assert.equal(res.body.data.description, 'Details here');
    });
  });

  describe('PUT /api/v1/announcements/:id (Update Announcement)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'PUT',
        body: { topic: 'Updated' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'PUT',
        token: forbiddenToken,
        body: { topic: 'Updated' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should return 400 Bad Request for malformed announcement ID', async () => {
      const res = await request('/api/v1/announcements/bad-id', {
        method: 'PUT',
        token: marketingToken,
        body: { topic: 'Updated' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return 404 Not Found for non-existent announcement ID', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'PUT',
        token: marketingToken,
        body: { topic: 'Updated' },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should reject empty topic string in update payload with 400 Bad Request', async () => {
      const createRes = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Initial Topic', description: 'Initial Desc' },
      });
      const anncId = createRes.body.data.id;

      const res = await request(`/api/v1/announcements/${anncId}`, {
        method: 'PUT',
        token: marketingToken,
        body: { topic: '   ' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should successfully update topic and description and record updated_by', async () => {
      const createRes = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'Old Topic', description: 'Old Description' },
      });
      const anncId = createRes.body.data.id;

      const updaterToken = generateTestToken({ id: UPDATER_ID, roles: ['marketing_team'] });

      const res = await request(`/api/v1/announcements/${anncId}`, {
        method: 'PUT',
        token: updaterToken,
        body: { topic: 'New Topic', description: 'New Description' },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.topic, 'New Topic');
      assert.equal(res.body.data.description, 'New Description');
      assert.equal(res.body.data.updated_by, UPDATER_ID);
    });
  });

  describe('DELETE /api/v1/announcements/:id (Delete Announcement)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'DELETE',
      });
      assert.equal(res.status, 401);
    });

    it('should reject non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'DELETE',
        token: forbiddenToken,
      });
      assert.equal(res.status, 403);
    });

    it('should return 400 Bad Request for malformed ID', async () => {
      const res = await request('/api/v1/announcements/invalid-id', {
        method: 'DELETE',
        token: marketingToken,
      });
      assert.equal(res.status, 400);
    });

    it('should return 404 Not Found for non-existent announcement', async () => {
      const res = await request('/api/v1/announcements/66b64f9e1234567890999999', {
        method: 'DELETE',
        token: marketingToken,
      });
      assert.equal(res.status, 404);
    });

    it('should successfully delete announcement and confirm removal via GET', async () => {
      const createRes = await request('/api/v1/announcements', {
        method: 'POST',
        token: marketingToken,
        body: { topic: 'To Be Deleted', description: 'Delete me' },
      });
      const anncId = createRes.body.data.id;

      const deleteRes = await request(`/api/v1/announcements/${anncId}`, {
        method: 'DELETE',
        token: marketingToken,
      });

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.success, true);
      assert.equal(deleteRes.body.data.deleted, true);
      assert.equal(deleteRes.body.data.id, anncId);

      const getRes = await request(`/api/v1/announcements/${anncId}`);
      assert.equal(getRes.status, 404);
    });
  });
});
