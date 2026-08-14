import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';

describe('Gallery Module API Tests', () => {
  let mediaTeamToken;
  let editorialTeamToken;
  let forbiddenToken;

  const MEDIA_TEAM_ID = '66b64f9e1234567890000001';
  const EDITORIAL_TEAM_ID = '66b64f9e1234567890000002';
  const FORBIDDEN_ID = '66b64f9e1234567890000003';

  before(async () => {
    await startTestServer();
    mediaTeamToken = generateTestToken({ id: MEDIA_TEAM_ID, roles: ['media_team'] });
    editorialTeamToken = generateTestToken({ id: EDITORIAL_TEAM_ID, roles: ['editorial_team'] });
    forbiddenToken = generateTestToken({ id: FORBIDDEN_ID, roles: ['marketing_team'] });
  });

  after(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/gallery/upload-signature (Get Presigned Upload Signature)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=events&resource_type=image');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request from non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=events&resource_type=image', {
        token: forbiddenToken,
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject request missing folder parameter with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/upload-signature?resource_type=image', {
        token: mediaTeamToken,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject request missing resource_type parameter with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=events', {
        token: mediaTeamToken,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject request with invalid resource_type with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=events&resource_type=exe', {
        token: mediaTeamToken,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return signature payload for media_team role including folder', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=events&resource_type=image', {
        token: mediaTeamToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.upload_url);
      assert.ok(res.body.data.signature);
      assert.ok(res.body.data.timestamp);
      assert.ok(res.body.data.api_key);
      assert.equal(res.body.data.folder, 'events');
      assert.ok(res.body.data.upload_url.endsWith('/image/upload'));
    });

    it('should return signature payload for editorial_team role', async () => {
      const res = await request('/api/v1/gallery/upload-signature?folder=magazines&resource_type=raw', {
        token: editorialTeamToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.folder, 'magazines');
      assert.ok(res.body.data.upload_url.endsWith('/raw/upload'));
    });
  });

  describe('POST /api/v1/gallery/items (Create Gallery Showcase Item)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        body: {
          title: 'Opening Ceremony',
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/photo.jpg',
          media_type: 'image',
          collection_name: 'Hackathon 2026',
        },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject request from non-media role with 403 Forbidden', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: forbiddenToken,
        body: {
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/photo.jpg',
          media_type: 'image',
          collection_name: 'Hackathon 2026',
        },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject request with missing media_url with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          media_type: 'image',
          collection_name: 'Hackathon 2026',
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject request with invalid media_type with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/photo.jpg',
          media_type: 'audio',
          collection_name: 'Hackathon 2026',
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject request missing collection_name with 400 Bad Request', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/photo.jpg',
          media_type: 'image',
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should successfully create gallery showcase item for media_team role', async () => {
      const res = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          title: 'Keynote Speech',
          caption: 'Professor keynote at annual fest',
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/keynote.jpg',
          media_type: 'image',
          collection_name: 'Hackathon 2026',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.equal(res.body.data.title, 'Keynote Speech');
      assert.equal(res.body.data.caption, 'Professor keynote at annual fest');
      assert.equal(res.body.data.media_url, 'https://res.cloudinary.com/aces/image/upload/v1/keynote.jpg');
      assert.equal(res.body.data.media_type, 'image');
      assert.equal(res.body.data.collection_name, 'Hackathon 2026');
      assert.equal(res.body.data.auditing.created_by, MEDIA_TEAM_ID);
    });
  });

  describe('POST /api/v1/gallery/items/batch (Batch Upload Gallery Items)', () => {
    it('should batch create multiple photos and videos for a collection', async () => {
      const res = await request('/api/v1/gallery/items/batch', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          collection_name: 'Freshers Party 2025',
          items: [
            {
              title: 'Group Photo',
              media_url: 'https://res.cloudinary.com/aces/image/upload/v1/group.jpg',
              media_type: 'image',
            },
            {
              title: 'Dance Performance Video',
              media_url: 'https://res.cloudinary.com/aces/video/upload/v1/dance.mp4',
              media_type: 'video',
            },
          ],
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.collection_name, 'Freshers Party 2025');
      assert.equal(res.body.data.count, 2);
      assert.equal(res.body.data.items.length, 2);
    });
  });

  describe('GET /api/v1/gallery/showcase & GET /api/v1/gallery/collections/:collection_name', () => {
    beforeEach(async () => {
      // Seed sample gallery items across two collections
      await request('/api/v1/gallery/items/batch', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          collection_name: 'Tech Symposium 2026',
          items: [
            {
              title: 'Symposium Banner',
              media_url: 'https://res.cloudinary.com/aces/image/upload/v1/banner.jpg',
              media_type: 'image',
            },
            {
              title: 'Project Demo Video',
              media_url: 'https://res.cloudinary.com/aces/video/upload/v1/demo.mp4',
              media_type: 'video',
            },
          ],
        },
      });

      await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          title: 'Cultural Night Photo',
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/cultural.jpg',
          media_type: 'image',
          collection_name: 'Cultural Fest 2025',
        },
      });
    });

    it('should return entire showcase organized in collections', async () => {
      const res = await request('/api/v1/gallery/showcase');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.collections));
      assert.equal(res.body.data.collections.length, 2);

      const symposiumCol = res.body.data.collections.find(
        (c) => c.collection_name === 'Tech Symposium 2026'
      );
      assert.ok(symposiumCol);
      assert.equal(symposiumCol.total_items, 2);
      assert.equal(symposiumCol.photos_count, 1);
      assert.equal(symposiumCol.videos_count, 1);
      assert.equal(symposiumCol.items.length, 2);
    });

    it('should fetch media items via specific collection name', async () => {
      const res = await request('/api/v1/gallery/collections/Tech%20Symposium%202026');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.collection_name, 'Tech Symposium 2026');
      assert.equal(res.body.data.total_items, 2);
      assert.equal(res.body.data.photos_count, 1);
      assert.equal(res.body.data.videos_count, 1);
      assert.equal(res.body.data.items.length, 2);
    });

    it('should return 404 for non-existent collection name', async () => {
      const res = await request('/api/v1/gallery/collections/NonExistentCollection');

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should list summary of all collections', async () => {
      const res = await request('/api/v1/gallery/collections');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.collections.length, 2);
    });
  });

  describe('PUT & DELETE /api/v1/gallery/items/:id', () => {
    let itemId;

    beforeEach(async () => {
      const createRes = await request('/api/v1/gallery/items', {
        method: 'POST',
        token: mediaTeamToken,
        body: {
          title: 'Initial Photo',
          media_url: 'https://res.cloudinary.com/aces/image/upload/v1/init.jpg',
          media_type: 'image',
          collection_name: 'Hackathon 2026',
        },
      });
      itemId = createRes.body.data.id;
    });

    it('should update gallery item title and collection name', async () => {
      const res = await request(`/api/v1/gallery/items/${itemId}`, {
        method: 'PUT',
        token: mediaTeamToken,
        body: {
          title: 'Updated Keynote Photo',
          collection_name: 'Hackathon 2026 Grand Finale',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.title, 'Updated Keynote Photo');
      assert.equal(res.body.data.collection_name, 'Hackathon 2026 Grand Finale');
    });

    it('should delete gallery item', async () => {
      const delRes = await request(`/api/v1/gallery/items/${itemId}`, {
        method: 'DELETE',
        token: mediaTeamToken,
      });

      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);

      const getRes = await request(`/api/v1/gallery/items/${itemId}`);
      assert.equal(getRes.status, 404);
    });
  });
});
