import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';
import { formatGoogleSheetCsvUrl, parseCSV } from '../iam/internal/iam.service.internal.js';

describe('IAM Module API Tests - Bulk Register Endpoint', () => {
  let adminToken;
  let memberToken;
  const originalFetch = globalThis.fetch;

  function mockExternalFetch(handler) {
    globalThis.fetch = async (url, options) => {
      const urlStr = String(url);
      if (urlStr.startsWith('http://localhost') || urlStr.includes('127.0.0.1')) {
        return originalFetch(url, options);
      }
      return handler(url, options);
    };
  }

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ roles: ['admin'] });
    memberToken = generateTestToken({ roles: ['event_team'] });
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    await stopTestServer();
  });

  beforeEach(async () => {
    globalThis.fetch = originalFetch;
    await clearDatabase();
  });

  describe('CSV Parser and Google Sheet URL Utilities', () => {
    it('should format normal Google Sheet edit URLs to CSV export format', () => {
      const editUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
      const formatted = formatGoogleSheetCsvUrl(editUrl);
      assert.equal(
        formatted,
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv'
      );
    });

    it('should preserve published Google Sheet CSV URLs', () => {
      const pubUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pub?output=csv';
      const formatted = formatGoogleSheetCsvUrl(pubUrl);
      assert.equal(formatted, pubUrl);
    });

    it('should parse CSV with header variations and quoted values correctly', () => {
      const csvData = `Full Name, Email Address, Team Name, Designation\n"Doe, Jane", jane.doe@example.com, Web Team, Head\nJohn Smith, john.smith@example.com, Technical Team, Member`;
      const records = parseCSV(csvData);
      assert.equal(records.length, 2);
      assert.equal(records[0].name, 'Doe, Jane');
      assert.equal(records[0].email, 'jane.doe@example.com');
      assert.equal(records[0].team, 'Web Team');
      assert.equal(records[0].position, 'Head');

      assert.equal(records[1].name, 'John Smith');
      assert.equal(records[1].email, 'john.smith@example.com');
      assert.equal(records[1].team, 'Technical Team');
      assert.equal(records[1].position, 'Member');
    });
  });

  describe('POST /api/v1/iam/bulk-register Authorization & Input Validation', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/pub?output=csv' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject non-admin request with 403 Forbidden', async () => {
      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: memberToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/pub?output=csv' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject missing Google Sheet URL with 400 Bad Request', async () => {
      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: {},
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.match(res.body.error.message, /Google Sheet URL is required/i);
    });

    it('should reject invalid URL string with 400 Bad Request', async () => {
      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'not-a-valid-url' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.match(res.body.error.message, /Invalid Google Sheet URL format/i);
    });
  });

  describe('POST /api/v1/iam/bulk-register Processing & Execution', () => {
    it('should handle fetch HTTP failure gracefully with 400 Bad Request', async () => {
      mockExternalFetch(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-fake/pub?output=csv' },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error.message, /Failed to fetch Google Sheet/i);
    });

    it('should reject HTML web page responses (unpublished sheets) with 400 Bad Request', async () => {
      mockExternalFetch(async () => ({
        ok: true,
        text: async () => '<!DOCTYPE html><html><body>Login page</body></html>',
      }));

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-fake/pub?output=csv' },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error.message, /Ensure the Google Sheet is published to the web in CSV format/i);
    });

    it('should reject CSV without mandatory header columns with 400 Bad Request', async () => {
      mockExternalFetch(async () => ({
        ok: true,
        text: async () => 'Name, Phone, City\nAlice, 123456, NY',
      }));

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-fake/pub?output=csv' },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.error.message, /CSV sheet header must include email, team, and position/i);
    });

    it('should successfully bulk register all valid members from CSV sheet', async () => {
      const mockCsvContent = `Name, Email, Team, Position
Alice Walker, alice.walker@aces.org, Web Team, Head
Bob Vance, bob.vance@aces.org, Technical Team, Member
Carol Danvers, carol.danvers@aces.org, Media Team, Joint Head`;

      mockExternalFetch(async (url) => {
        assert.ok(url.includes('pub?output=csv'));
        return {
          ok: true,
          text: async () => mockCsvContent,
        };
      });

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-valid/pub?output=csv' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.total, 3);
      assert.equal(res.body.data.successfulCount, 3);
      assert.equal(res.body.data.failedCount, 0);
      assert.equal(res.body.data.successful.length, 3);

      assert.equal(res.body.data.successful[0].email, 'alice.walker@aces.org');
      assert.equal(res.body.data.successful[0].team, 'Web Team');
      assert.equal(res.body.data.successful[0].position, 'Head');
      assert.equal(res.body.data.successful[0].status, 'NOT_ACTIVE');

      assert.equal(res.body.data.successful[1].email, 'bob.vance@aces.org');
      assert.equal(res.body.data.successful[1].team, 'Technical Team');
      assert.equal(res.body.data.successful[1].position, 'Member');

      assert.equal(res.body.data.successful[2].email, 'carol.danvers@aces.org');
      assert.equal(res.body.data.successful[2].team, 'Media Team');
      assert.equal(res.body.data.successful[2].position, 'Joint Head');
    });

    it('should handle partial failure reporting duplicate emails or invalid team/position', async () => {
      // Pre-register one member first
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Alice Walker',
          email: 'alice.walker@aces.org',
          team: 'Web Team',
          position: 'Head',
        },
      });

      const mockCsvContent = `Name, Email, Team, Position
Alice Walker, alice.walker@aces.org, Web Team, Head
David Miller, david.miller@aces.org, NonExistentTeam, Head
Eve Adams, eve.adams@aces.org, Marketing Team, Member`;

      mockExternalFetch(async () => ({
        ok: true,
        text: async () => mockCsvContent,
      }));

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-partial/pub?output=csv' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.total, 3);
      assert.equal(res.body.data.successfulCount, 1);
      assert.equal(res.body.data.failedCount, 2);

      assert.equal(res.body.data.successful[0].email, 'eve.adams@aces.org');
      assert.equal(res.body.data.successful[0].team, 'Marketing Team');

      assert.equal(res.body.data.failed.length, 2);
      assert.equal(res.body.data.failed[0].row, 2);
      assert.equal(res.body.data.failed[0].email, 'alice.walker@aces.org');
      assert.match(res.body.data.failed[0].reason, /already exists/i);

      assert.equal(res.body.data.failed[1].row, 3);
      assert.equal(res.body.data.failed[1].email, 'david.miller@aces.org');
      assert.match(res.body.data.failed[1].reason, /Invalid team/i);
    });
  });
});
