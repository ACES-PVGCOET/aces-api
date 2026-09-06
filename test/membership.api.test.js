import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';

const FIXTURE_EXCEL_PATH = fileURLToPath(new URL('./fixtures/membership_responses.xlsx', import.meta.url));

describe('Membership & Fee Verification Module API Tests', () => {
  let adminToken;
  let treasuryToken;

  const ADMIN_ID = '66b64f9e1234567890000001';
  const TREASURY_ID = '66b64f9e1234567890000002';

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ id: ADMIN_ID, name: 'Admin Lead', roles: ['admin'] });
    treasuryToken = generateTestToken({ id: TREASURY_ID, name: 'Treasury Lead', roles: ['treasury_team'] });
  });

  after(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/membership (List Memberships)', () => {
    it('should return empty list when no members are registered', async () => {
      const res = await request('/api/v1/membership');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.items, []);
      assert.equal(res.body.data.total, 0);
    });

    it('should create and retrieve a registration', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Test Student',
          class_name: 'TE',
          contact_number: '9876543210',
          email: 'test@college.edu',
          payment_mode: 'UPI',
          payment_date: '14/08/2026',
          amount: 100,
          transaction_ss_url: 'https://drive.google.com/open?id=sample123',
        },
      });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.success, true);
      assert.equal(createRes.body.data.full_name, 'Test Student');
      assert.equal(createRes.body.data.status, 'PENDING');

      const listRes = await request('/api/v1/membership');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.total, 1);
      assert.equal(listRes.body.data.items[0].full_name, 'Test Student');
      assert.equal(listRes.body.data.items[0].contact_number, '9876543210');
    });
  });

  describe('PATCH /api/v1/membership/:id/verify (Verify & Reject)', () => {
    it('should verify a membership fee and assign receipt number', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Ananya Sharma',
          class_name: 'BE',
          contact_number: '9123456780',
          payment_mode: 'UPI',
        },
      });

      const memberId = createRes.body.data.id;

      const verifyRes = await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'VERIFIED',
          remarks: 'UPI reference verified against bank statement',
        },
      });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.data.status, 'VERIFIED');
      assert.ok(verifyRes.body.data.receipt_number.startsWith('ACES-'));
      assert.equal(verifyRes.body.data.verified_by, 'Admin Lead');
      assert.ok(verifyRes.body.data.verified_at);

      // Check stats reflect verified fee
      const statsRes = await request('/api/v1/membership/stats');
      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.data.verified, 1);
      assert.equal(statsRes.body.data.pending, 0);
      assert.equal(statsRes.body.data.totalCollected, 450);
    });

    it('should reject a membership fee with reason', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Invalid Payment Student',
          class_name: 'SE',
          contact_number: '9123456789',
        },
      });

      const memberId = createRes.body.data.id;

      const rejectRes = await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: adminToken,
        body: {
          status: 'REJECTED',
          remarks: 'Transaction ID does not match amount',
        },
      });

      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.data.status, 'REJECTED');
      assert.equal(rejectRes.body.data.remarks, 'Transaction ID does not match amount');
    });
  });

  describe('POST /api/v1/membership/import-local-sheet (Excel Import)', () => {
    it('should import records from the local Excel responses fixture', async () => {
      const importRes = await request('/api/v1/membership/import-local-sheet', {
        method: 'POST',
        token: adminToken,
        body: {
          file_path: FIXTURE_EXCEL_PATH,
        },
      });

      assert.equal(importRes.status, 200);
      assert.equal(importRes.body.success, true);
      assert.ok(importRes.body.data.importedCount > 0, 'Should import records');
      assert.equal(importRes.body.data.totalSubmitted, 73);

      // Verify records are queryable and classes are normalized
      const listRes = await request('/api/v1/membership?limit=200');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.items.length, importRes.body.data.importedCount);
      
      const firstStudent = listRes.body.data.items.find((s) => s.full_name.includes('Prathamesh Mete'));
      assert.ok(firstStudent);
      assert.equal(firstStudent.class_name, 'BE');
      assert.equal(firstStudent.contact_number, '7219366476');
      assert.ok(firstStudent.transaction_ss_url.includes('drive.google.com'));

      // Re-importing should skip duplicates
      const reimportRes = await request('/api/v1/membership/import-local-sheet', {
        method: 'POST',
        token: adminToken,
        body: {
          file_path: FIXTURE_EXCEL_PATH,
        },
      });
      assert.equal(reimportRes.status, 200);
      assert.equal(reimportRes.body.data.importedCount, 0);
      assert.equal(reimportRes.body.data.skippedCount, 73);
    });
  });
});
