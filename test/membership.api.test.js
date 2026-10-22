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
  let webToken;
  let unauthorizedToken;

  const ADMIN_ID = '66b64f9e1234567890000001';
  const TREASURY_ID = '66b64f9e1234567890000002';
  const WEB_ID = '66b64f9e1234567890000003';
  const UNAUTHORIZED_ID = '66b64f9e1234567890000004';

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ id: ADMIN_ID, name: 'Admin Lead', roles: ['admin'] });
    treasuryToken = generateTestToken({ id: TREASURY_ID, name: 'Treasury Lead', roles: ['treasury_team'] });
    webToken = generateTestToken({ id: WEB_ID, name: 'Web Lead', roles: ['web_team'] });
    unauthorizedToken = generateTestToken({ id: UNAUTHORIZED_ID, name: 'Event Member', roles: ['event_team'] });
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

  describe('PATCH /api/v1/membership/:id/verify (Verify & RBAC)', () => {
    it('should reject unauthenticated verification request with 401', async () => {
      const res = await request('/api/v1/membership/66bc600011223344556677aa/verify', {
        method: 'PATCH',
        body: { status: 'VERIFIED' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject unauthorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/membership/66bc600011223344556677aa/verify', {
        method: 'PATCH',
        token: unauthorizedToken,
        body: { status: 'VERIFIED' },
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should allow treasury_team to verify a membership fee and assign receipt number', async () => {
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
        token: treasuryToken,
        body: {
          status: 'VERIFIED',
          remarks: 'UPI reference verified against bank statement',
        },
      });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.data.status, 'VERIFIED');
      assert.ok(verifyRes.body.data.receipt_number.startsWith('ACES-'));
      assert.equal(verifyRes.body.data.verified_by, 'Treasury Lead');
      assert.ok(verifyRes.body.data.verified_at);

      // Check stats reflect verified fee
      const statsRes = await request('/api/v1/membership/stats');
      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.data.verified, 1);
      assert.equal(statsRes.body.data.pending, 0);
      assert.equal(statsRes.body.data.totalCollected, 450);
    });

    it('should generate ID card, dispatch welcome email, and set receipt_status to SENT when member has an email', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Pooja Deshpande',
          email: 'pooja.deshpande@college.edu',
          class_name: 'TE',
          contact_number: '9822334455',
          payment_mode: 'UPI',
        },
      });

      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      const verifyRes = await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: {
          status: 'VERIFIED',
          remarks: 'Verified fee payment',
        },
      });

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.data.status, 'VERIFIED');
      assert.equal(verifyRes.body.data.receipt_status, 'SENT');
      assert.ok(verifyRes.body.data.receipt_number);
    });

    it('should allow admin to reject a membership fee with reason', async () => {
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

  describe('PUT & DELETE /api/v1/membership/:id (Management RBAC)', () => {
    it('should protect PUT endpoint with RBAC', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Edit Student',
          class_name: 'SE',
          contact_number: '9111111111',
        },
      });
      const memberId = createRes.body.data.id;

      // 401 without auth
      const unauthRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'PUT',
        body: { amount: 500 },
      });
      assert.equal(unauthRes.status, 401);

      // 403 with wrong role
      const forbiddenRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'PUT',
        token: unauthorizedToken,
        body: { amount: 500 },
      });
      assert.equal(forbiddenRes.status, 403);

      // 200 with web_team
      const okRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'PUT',
        token: webToken,
        body: { amount: 500, remarks: 'Updated fee' },
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.data.amount, 500);
      assert.equal(okRes.body.data.remarks, 'Updated fee');
    });

    it('should protect DELETE endpoint with RBAC', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Delete Student',
          class_name: 'SE',
          contact_number: '9222222222',
        },
      });
      const memberId = createRes.body.data.id;

      // 401 without auth
      const unauthRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'DELETE',
      });
      assert.equal(unauthRes.status, 401);

      // 403 with wrong role
      const forbiddenRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'DELETE',
        token: unauthorizedToken,
      });
      assert.equal(forbiddenRes.status, 403);

      // 200 with admin
      const okRes = await request(`/api/v1/membership/${memberId}`, {
        method: 'DELETE',
        token: adminToken,
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.success, true);
      assert.equal(okRes.body.data.full_name, 'Delete Student');
    });

    it('should delete membership by email and by receipt number', async () => {
      // 1. Create a member with email
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Delete By Email Student',
          class_name: 'TE',
          contact_number: '9222222223',
          email: 'delete.me@college.edu',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      // Verify member to assign receipt number
      await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: { status: 'VERIFIED', receipt_number: 'ACES-2026-DEL1' },
      });

      // Delete by receipt number in URL param
      const delReceiptRes = await request('/api/v1/membership/ACES-2026-DEL1', {
        method: 'DELETE',
        token: adminToken,
      });
      assert.equal(delReceiptRes.status, 200);
      assert.equal(delReceiptRes.body.data.email, 'delete.me@college.edu');

      // Verify it's gone
      const getRes = await request(`/api/v1/membership/${memberId}`);
      assert.equal(getRes.status, 404);

      // 2. Create another member and delete using email via DELETE / with body
      await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Delete By Body Student',
          class_name: 'BE',
          contact_number: '9222222224',
          email: 'delete.body@college.edu',
        },
      });

      const delBodyRes = await request('/api/v1/membership', {
        method: 'DELETE',
        token: treasuryToken,
        body: { email: 'delete.body@college.edu' },
      });
      assert.equal(delBodyRes.status, 200);
      assert.equal(delBodyRes.body.data.full_name, 'Delete By Body Student');
    });

    it('should return 404 when deleting a non-existent membership identifier', async () => {
      const res = await request('/api/v1/membership/66bc600011223344556677aa', {
        method: 'DELETE',
        token: adminToken,
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });


  describe('Bulk & Spreadsheet Imports RBAC', () => {
    it('should protect POST /bulk-import with RBAC', async () => {
      // 401 without auth
      const unauthRes = await request('/api/v1/membership/bulk-import', {
        method: 'POST',
        body: { records: [{ full_name: 'A', contact_number: '9999999999' }] },
      });
      assert.equal(unauthRes.status, 401);

      // 403 with wrong role
      const forbiddenRes = await request('/api/v1/membership/bulk-import', {
        method: 'POST',
        token: unauthorizedToken,
        body: { records: [{ full_name: 'A', contact_number: '9999999999' }] },
      });
      assert.equal(forbiddenRes.status, 403);

      // 200 with treasury_team
      const okRes = await request('/api/v1/membership/bulk-import', {
        method: 'POST',
        token: treasuryToken,
        body: {
          records: [
            {
              full_name: 'Bulk Student 1',
              class_name: 'SE',
              contact_number: '9333333333',
            },
          ],
        },
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.data.importedCount, 1);
    });

    it('should protect POST /import-local-sheet with RBAC and import records', async () => {
      // 401 without auth
      const unauthRes = await request('/api/v1/membership/import-local-sheet', {
        method: 'POST',
        body: { file_path: FIXTURE_EXCEL_PATH },
      });
      assert.equal(unauthRes.status, 401);

      // 403 with wrong role
      const forbiddenRes = await request('/api/v1/membership/import-local-sheet', {
        method: 'POST',
        token: unauthorizedToken,
        body: { file_path: FIXTURE_EXCEL_PATH },
      });
      assert.equal(forbiddenRes.status, 403);

      // 200 with adminToken
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

  describe('GET /api/v1/membership/id-card/:membershipNo (Digital ID Card Retrieval)', () => {
    it('should return 404 when membership number does not exist', async () => {
      const res = await request('/api/v1/membership/id-card/NONEXISTENT-NO');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should return 403 error when member is not yet verified (PENDING status)', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Pending Student',
          class_name: 'SE',
          contact_number: '9888877771',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      const res = await request(`/api/v1/membership/id-card/${memberId}`);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'FORBIDDEN');
      assert.ok(res.body.error.message.includes('not verified'));
    });

    it('should return 200 and image/png ID card when member is verified', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        body: {
          full_name: 'Verified Student',
          class_name: 'TE',
          contact_number: '9888877772',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      // Verify the member
      const verifyRes = await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: {
          status: 'VERIFIED',
          receipt_number: 'ACES-2026-TEST99',
        },
      });
      assert.equal(verifyRes.status, 200);

      // Fetch ID card by receipt/membership number
      const cardRes = await request('/api/v1/membership/id-card/ACES-2026-TEST99');
      assert.equal(cardRes.status, 200);
      assert.equal(cardRes.headers['content-type'], 'image/png');
      assert.ok(cardRes.headers['content-disposition'].includes('ACES-ID-ACES-2026-TEST99.png'));
      assert.ok(cardRes.buffer && cardRes.buffer.length > 10000);
      // Verify PNG magic bytes
      assert.equal(cardRes.buffer[0], 0x89);
      assert.equal(cardRes.buffer[1], 0x50);
      assert.equal(cardRes.buffer[2], 0x4e);
      assert.equal(cardRes.buffer[3], 0x47);
    });
  });

  describe('POST & GET /api/v1/membership/sync (Forms API Sync & Optimization)', () => {
    it('should return 400 when invalid form_id format is provided', async () => {
      const res = await request('/api/v1/membership/sync', {
        method: 'POST',
        body: { form_id: 'invalid-id' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('should return 404 when form_id does not exist', async () => {
      const res = await request('/api/v1/membership/sync', {
        method: 'POST',
        body: { form_id: '66b64f9e1234567890999999' },
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('should sync members from form responses, store lastMembershipSynced in DB, and ignore existing memberships by email', async () => {
      // 1. Create a membership form via Forms API
      const formRes = await request('/api/v1/forms', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'ACES Annual Membership Drive 2026',
          description: 'Official registration form for ACES',
          questions: [
            {
              question_serial: 1,
              question_statement: 'Full Name',
              question_type: 'textual',
              is_required: true,
            },
            {
              question_serial: 2,
              question_statement: 'Class / Year of Study',
              question_type: 'multiple_choice',
              multiple_choice_policy: {
                type: 'Single',
                options: ['SE', 'TE', 'BE'],
              },
              is_required: true,
            },
            {
              question_serial: 3,
              question_statement: 'Membership Payment Confirmation',
              question_type: 'payment_acceptance',
              payment_policy: {
                amount: 450,
                primary_qr_url: 'https://res.cloudinary.com/aces/qr/primary.png',
              },
              is_required: true,
            },
            {
              question_serial: 4,
              question_statement: 'WhatsApp Contact Number',
              question_type: 'textual',
              is_required: false,
            },
          ],
        },
      });
      assert.equal(formRes.status, 201);
      const formId = formRes.body.data.form_id;

      // 2. Pre-create one existing membership in DB with email 'existing@college.edu'
      await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Existing Member',
          email: 'existing@college.edu',
          class_name: 'TE',
          contact_number: '9111111111',
          payment_mode: 'UPI',
          amount: 450,
          transaction_ss_url: 'https://res.cloudinary.com/aces/existing_receipt.png',
        },
      });

      // 3. Submit responses to the form: one existing email, two new emails
      const resp1 = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'existing@college.edu',
          answers: {
            '1': ['Existing Member New Submission'],
            '2': ['TE'],
            '3': ['https://res.cloudinary.com/aces/new_ss1.png'],
            '4': ['9111111111'],
          },
        },
      });
      assert.equal(resp1.status, 201);

      const resp2 = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'alice.smith@college.edu',
          answers: {
            '1': ['Alice Smith'],
            '2': ['SE'],
            '3': ['https://res.cloudinary.com/aces/alice_ss.png'],
            '4': ['9876543210'],
          },
        },
      });
      assert.equal(resp2.status, 201);

      const resp3 = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'bob.jones@college.edu',
          answers: {
            '1': ['Bob Jones'],
            '2': ['BE'],
            '3': ['https://res.cloudinary.com/aces/bob_ss.png'],
            '4': ['9888877777'],
          },
        },
      });
      assert.equal(resp3.status, 201);

      // 4. Trigger /sync endpoint
      const syncRes = await request('/api/v1/membership/sync', {
        method: 'POST',
        body: { form_id: formId },
      });
      assert.equal(syncRes.status, 200);
      assert.equal(syncRes.body.success, true);
      assert.equal(syncRes.body.data.synced_count, 2); // Alice and Bob
      assert.equal(syncRes.body.data.skipped_count, 1); // existing@college.edu ignored
      assert.ok(syncRes.body.data.lastMembershipSynced);

      // Verify records in Membership collection
      const listRes = await request('/api/v1/membership');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.total, 3); // Pre-existing + Alice + Bob

      const alice = listRes.body.data.items.find((m) => m.email === 'alice.smith@college.edu');
      assert.ok(alice);
      assert.equal(alice.full_name, 'Alice Smith');
      assert.equal(alice.class_name, 'SE');
      assert.equal(alice.contact_number, '9876543210');
      assert.equal(alice.transaction_ss_url, 'https://res.cloudinary.com/aces/alice_ss.png');
      assert.equal(alice.source, 'forms_api_sync');
      assert.equal(alice.status, 'PENDING');

      const bob = listRes.body.data.items.find((m) => m.email === 'bob.jones@college.edu');
      assert.ok(bob);
      assert.equal(bob.full_name, 'Bob Jones');
      assert.equal(bob.class_name, 'BE');
      assert.equal(bob.amount, 450);

      // Existing member was not overwritten
      const existing = listRes.body.data.items.find((m) => m.email === 'existing@college.edu');
      assert.ok(existing);
      assert.equal(existing.full_name, 'Existing Member');

      // 5. Optimization verification: Immediate second sync without new submissions
      const secondSync = await request(`/api/v1/membership/sync?form_id=${formId}`, {
        method: 'GET',
      });
      assert.equal(secondSync.status, 200);
      assert.equal(secondSync.body.data.total_fetched, 0); // No new responses since lastMembershipSynced
      assert.equal(secondSync.body.data.synced_count, 0);
      assert.equal(secondSync.body.data.skipped_count, 0);

      // 6. Submit a 4th response after lastMembershipSynced
      // Wait a tiny moment to ensure distinct timestamp
      await new Promise((r) => setTimeout(r, 20));

      const resp4 = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'charlie.brown@college.edu',
          answers: {
            '1': ['Charlie Brown'],
            '2': ['TE'],
            '3': ['https://res.cloudinary.com/aces/charlie_ss.png'],
            '4': ['9998887776'],
          },
        },
      });
      assert.equal(resp4.status, 201);

      // 7. Third sync only fetches Charlie
      const thirdSync = await request('/api/v1/membership/sync', {
        method: 'POST',
        body: { form_id: formId },
      });
      assert.equal(thirdSync.status, 200);
      assert.equal(thirdSync.body.data.total_fetched, 1);
      assert.equal(thirdSync.body.data.synced_count, 1);
      assert.equal(thirdSync.body.data.synced_members[0].email, 'charlie.brown@college.edu');

      // Check total members is now 4
      const finalListRes = await request('/api/v1/membership');
      assert.equal(finalListRes.body.data.total, 4);
    });

    it('should manage schema flexibly and enforce required fields: email, name, year, payment screenshot url', async () => {
      // Create a form with alternative phrasing and different question order
      const flexFormRes = await request('/api/v1/forms', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'Alternative Membership Registration Form',
          questions: [
            {
              question_serial: 1,
              question_statement: 'Current Year (SE/TE/BE)',
              question_type: 'textual',
              is_required: true,
            },
            {
              question_serial: 2,
              question_statement: 'Student Name',
              question_type: 'textual',
              is_required: true,
            },
            {
              question_serial: 3,
              question_statement: 'Upload Screenshot of Payment Transaction',
              question_type: 'file',
              file_policy: { supported_types: ['png', 'jpg', 'jpeg'], max_size_mb: 5 },
              is_required: false,
            },
          ],
        },
      });
      assert.equal(flexFormRes.status, 201);
      const formId = flexFormRes.body.data.form_id;

      // 1. Valid submission with flexible phrasing
      const validSub = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'flex.student@college.edu',
          answers: {
            '1': ['Second Year'],
            '2': ['David Miller'],
            '3': ['https://res.cloudinary.com/aces/david_receipt.png'],
          },
        },
      });
      assert.equal(validSub.status, 201);

      // 2. Submission missing payment screenshot (omitted answer for question 3)
      const missingSsSub = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'incomplete@college.edu',
          answers: {
            '1': ['TE'],
            '2': ['Incomplete Student'],
          },
        },
      });
      assert.equal(missingSsSub.status, 201);

      // Trigger sync
      const syncRes = await request('/api/v1/membership/sync', {
        method: 'POST',
        body: { form_id: formId },
      });
      assert.equal(syncRes.status, 200);
      assert.equal(syncRes.body.data.synced_count, 1);
      assert.equal(syncRes.body.data.failed_count, 1);
      assert.ok(syncRes.body.data.errors && syncRes.body.data.errors.length === 1);
      assert.ok(syncRes.body.data.errors[0].error.includes('payment screen shot url'));

      const david = await request('/api/v1/membership?search=David');
      assert.equal(david.body.data.total, 1);
      assert.equal(david.body.data.items[0].class_name, 'SE'); // 'Second Year' normalized to 'SE'
    });

    it('should use MEMBERSHIP_FORM_ID from environment variable when not specified in body/query', async () => {
      // Create a form
      const envFormRes = await request('/api/v1/forms', {
        method: 'POST',
        token: adminToken,
        body: {
          title: 'Env Configured Membership Form',
          questions: [
            {
              question_serial: 1,
              question_statement: 'Full Name',
              question_type: 'textual',
              is_required: true,
            },
            {
              question_serial: 2,
              question_statement: 'Year',
              question_type: 'textual',
              is_required: true,
            },
            {
              question_serial: 3,
              question_statement: 'Payment Screenshot',
              question_type: 'file',
              is_required: true,
            },
          ],
        },
      });
      assert.equal(envFormRes.status, 201);
      const formId = envFormRes.body.data.form_id;

      // Set process.env.MEMBERSHIP_FORM_ID
      const originalEnv = process.env.MEMBERSHIP_FORM_ID;
      process.env.MEMBERSHIP_FORM_ID = formId;

      try {
        await request(`/api/v1/forms/${formId}/responses`, {
          method: 'POST',
          body: {
            email: 'env.test@college.edu',
            answers: {
              '1': ['Env User'],
              '2': ['BE'],
              '3': ['https://res.cloudinary.com/aces/env_proof.png'],
            },
          },
        });

        // Call /sync without passing form_id
        const syncRes = await request('/api/v1/membership/sync', {
          method: 'POST',
        });
        assert.equal(syncRes.status, 200);
        assert.equal(syncRes.body.data.form_id, formId);
        assert.equal(syncRes.body.data.synced_count, 1);
      } finally {
        process.env.MEMBERSHIP_FORM_ID = originalEnv;
      }
    });
  });

  describe('POST /api/v1/membership/:id/resend-email (Resend Membership Email with ID Card)', () => {
    it('should return 404 when membership record does not exist', async () => {
      const res = await request('/api/v1/membership/66bc60001122334455667799/resend-email', {
        method: 'POST',
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.message.includes('not found'));
    });

    it('should return 400 when member does not have an email address', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'No Email Student',
          class_name: 'SE',
          contact_number: '9876543210',
          email: '',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      // Verify the member first
      await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: { status: 'VERIFIED' },
      });

      const res = await request(`/api/v1/membership/${memberId}/resend-email`, {
        method: 'POST',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.message.includes('email'));
    });

    it('should return 403 Forbidden when member is not verified (status PENDING)', async () => {
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Pending Student',
          class_name: 'TE',
          contact_number: '9876543211',
          email: 'pending.student@college.edu',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      const res = await request(`/api/v1/membership/${memberId}/resend-email`, {
        method: 'POST',
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.message.includes('not verified'));
    });

    it('should successfully resend membership verification email with ID card by ID', async () => {
      // 1. Create member
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Tanvi Joshi',
          class_name: 'TE',
          contact_number: '9876543212',
          email: 'tanvi.joshi@college.edu',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      // 2. Verify member
      const verifyRes = await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: {
          status: 'VERIFIED',
          receipt_number: 'ACES-2026-TEST88',
        },
      });
      assert.equal(verifyRes.status, 200);

      // 3. Resend email
      const resendRes = await request(`/api/v1/membership/${memberId}/resend-email`, {
        method: 'POST',
      });
      assert.equal(resendRes.status, 200);
      assert.equal(resendRes.body.success, true);
      assert.equal(resendRes.body.data.email, 'tanvi.joshi@college.edu');
      assert.equal(resendRes.body.data.receipt_number, 'ACES-2026-TEST88');
      assert.equal(resendRes.body.data.receipt_status, 'SENT');
      assert.ok(resendRes.body.data.message.includes('resent successfully'));
    });

    it('should successfully resend membership email by membership receipt number and via /resend-email endpoint', async () => {
      // 1. Create and verify member
      const createRes = await request('/api/v1/membership', {
        method: 'POST',
        token: adminToken,
        body: {
          full_name: 'Sameer Rao',
          class_name: 'BE',
          contact_number: '9876543213',
          email: 'sameer.rao@college.edu',
        },
      });
      assert.equal(createRes.status, 201);
      const memberId = createRes.body.data.id;

      await request(`/api/v1/membership/${memberId}/verify`, {
        method: 'PATCH',
        token: treasuryToken,
        body: {
          status: 'VERIFIED',
          receipt_number: 'ACES-2026-SAMEER1',
        },
      });

      // 2. Resend using receipt number in URL param
      const paramRes = await request('/api/v1/membership/ACES-2026-SAMEER1/resend-email', {
        method: 'POST',
      });
      assert.equal(paramRes.status, 200);
      assert.equal(paramRes.body.data.email, 'sameer.rao@college.edu');

      // 3. Resend using POST /resend-email with email in body
      const bodyRes = await request('/api/v1/membership/resend-email', {
        method: 'POST',
        body: { email: 'sameer.rao@college.edu' },
      });
      assert.equal(bodyRes.status, 200);
      assert.equal(bodyRes.body.data.receipt_number, 'ACES-2026-SAMEER1');
    });
  });
});



