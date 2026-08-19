import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  clearDatabase,
  generateTestToken,
  request,
} from './helpers/testServer.js';

describe('Forms Module API Tests', () => {
  let adminToken;
  let eventTeamToken;
  let editorialTeamToken;
  let forbiddenToken;
  let memberToken;

  const ADMIN_ID = '66b64f9e1234567890000001';
  const EVENT_ID = '66b64f9e1234567890000002';
  const EDITORIAL_ID = '66b64f9e1234567890000003';
  const FORBIDDEN_ID = '66b64f9e1234567890000004';
  const MEMBER_ID = '66b64f9e1234567890000099';

  before(async () => {
    await startTestServer();
    adminToken = generateTestToken({ id: ADMIN_ID, roles: ['admin'] });
    eventTeamToken = generateTestToken({ id: EVENT_ID, roles: ['event_team'] });
    editorialTeamToken = generateTestToken({ id: EDITORIAL_ID, roles: ['editorial_team'] });
    forbiddenToken = generateTestToken({ id: FORBIDDEN_ID, roles: ['marketing_team'] });
    memberToken = generateTestToken({ id: MEMBER_ID, roles: ['general_member'] });
  });

  after(async () => {
    await stopTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  const getValidFormPayload = () => ({
    title: 'Hackathon 2026 Registration',
    description: 'Registration form for team entries',
    questions: [
      {
        question_serial: 1,
        question_statement: 'Team Name',
        question_type: 'textual',
        is_required: true,
        textual_policy: { max_len: 20 },
      },
      {
        question_serial: 2,
        question_statement: 'Domain Track',
        question_type: 'multiple_choice',
        is_required: true,
        multiple_choice_policy: {
          type: 'Single',
          options: ['AI/ML', 'Web Arch', 'Cybersecurity'],
        },
      },
      {
        question_serial: 3,
        question_statement: 'Project Pitch (PDF)',
        question_type: 'file',
        is_required: false,
        file_policy: {
          supported_types: ['pdf'],
          max_size_mb: 5,
        },
      },
    ],
  });

  describe('POST /api/v1/forms (Create Form)', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request('/api/v1/forms', {
        method: 'POST',
        body: getValidFormPayload(),
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('should reject non-authorized role with 403 Forbidden', async () => {
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: forbiddenToken,
        body: getValidFormPayload(),
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('should reject missing title with 400 Bad Request', async () => {
      const payload = getValidFormPayload();
      delete payload.title;
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject empty questions array with 400 Bad Request', async () => {
      const payload = { title: 'Empty Form', questions: [] };
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject duplicate question_serial with 400 Bad Request', async () => {
      const payload = {
        title: 'Duplicate Serial Form',
        questions: [
          { question_serial: 1, question_statement: 'Q1', question_type: 'textual' },
          { question_serial: 1, question_statement: 'Q2', question_type: 'textual' },
        ],
      };
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should reject invalid question_type with 400 Bad Request', async () => {
      const payload = {
        title: 'Invalid Type Form',
        questions: [
          { question_serial: 1, question_statement: 'Q1', question_type: 'unknown_type' },
        ],
      };
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should successfully create form for event_team role', async () => {
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.form_id);
      assert.equal(res.body.data.title, 'Hackathon 2026 Registration');
      assert.equal(res.body.data.question_count, 3);
    });

    it('should successfully create form for editorial_team role', async () => {
      const res = await request('/api/v1/forms', {
        method: 'POST',
        token: editorialTeamToken,
        body: getValidFormPayload(),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });

  describe('GET /api/v1/forms (List Forms)', () => {
    it('should return empty forms array when database is empty', async () => {
      const res = await request('/api/v1/forms');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data.forms, []);
      assert.equal(res.body.data.total, 0);
    });

    it('should filter forms by is_active query parameter', async () => {
      const form1Res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });

      const form2Res = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: { title: 'Closed Survey', questions: [{ question_serial: 1, question_statement: 'Feedback', question_type: 'textual' }] },
      });
      await request(`/api/v1/forms/${form2Res.body.data.form_id}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: { is_active: false },
      });

      const activeRes = await request('/api/v1/forms?is_active=true');
      assert.equal(activeRes.status, 200);
      assert.equal(activeRes.body.data.forms.length, 1);
      assert.equal(activeRes.body.data.forms[0].form_id, form1Res.body.data.form_id);

      const inactiveRes = await request('/api/v1/forms?is_active=false');
      assert.equal(inactiveRes.status, 200);
      assert.equal(inactiveRes.body.data.forms.length, 1);
      assert.equal(inactiveRes.body.data.forms[0].form_id, form2Res.body.data.form_id);
    });
  });

  describe('GET /api/v1/forms/:form_id (Get Form Details)', () => {
    it('should return 400 Bad Request for malformed form_id', async () => {
      const res = await request('/api/v1/forms/invalid-form-id');
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should return 404 Not Found for non-existent form_id', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('should return form details with ordered questions array', async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      const formId = createRes.body.data.form_id;

      const res = await request(`/api/v1/forms/${formId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.form_id, formId);
      assert.equal(res.body.data.questions.length, 3);
      assert.equal(res.body.data.questions[0].question_serial, 1);
      assert.equal(res.body.data.questions[1].question_serial, 2);
      assert.equal(res.body.data.questions[2].question_serial, 3);
    });
  });

  describe('PUT /api/v1/forms/:form_id (Update Form)', () => {
    it('should reject unauthenticated update with 401', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999', {
        method: 'PUT',
        body: { title: 'Updated' },
      });
      assert.equal(res.status, 401);
    });

    it('should reject forbidden role update with 403', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999', {
        method: 'PUT',
        token: forbiddenToken,
        body: { title: 'Updated' },
      });
      assert.equal(res.status, 403);
    });

    it('should reject empty title update with 400 Bad Request', async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      const formId = createRes.body.data.form_id;

      const res = await request(`/api/v1/forms/${formId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: { title: '   ' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });

    it('should update metadata and replace questions array successfully', async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      const formId = createRes.body.data.form_id;

      const updatePayload = {
        title: 'Updated Form Title',
        description: 'Updated Description',
        is_active: false,
        questions: [
          {
            question_serial: 1,
            question_statement: 'New Question 1',
            question_type: 'textual',
          },
        ],
      };

      const res = await request(`/api/v1/forms/${formId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: updatePayload,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.title, 'Updated Form Title');
      assert.equal(res.body.data.is_active, false);
      assert.equal(res.body.data.questions.length, 1);
      assert.equal(res.body.data.questions[0].question_statement, 'New Question 1');
    });
  });

  describe('POST /api/v1/forms/:form_id/responses (Submit Form Response)', () => {
    let formId;

    beforeEach(async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      if (!createRes.body || !createRes.body.data) {
        throw new Error(`Failed to create form in beforeEach: ${JSON.stringify(createRes.body)}`);
      }
      formId = createRes.body.data.form_id;
    });

    it('should reject response submission to closed form with 400 Bad Request', async () => {
      await request(`/api/v1/forms/${formId}`, {
        method: 'PUT',
        token: eventTeamToken,
        body: { is_active: false },
      });

      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user1@example.com',
          answers: { '1': ['Team Alpha'], '2': ['AI/ML'] },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('closed'));
    });

    it('should reject response submission missing filler email with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          answers: { '1': ['Team Alpha'], '2': ['AI/ML'] },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('email is required'));
    });

    it('should reject response submission with invalid filler email format with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'not-an-email',
          answers: { '1': ['Team Alpha'], '2': ['AI/ML'] },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('valid email address'));
    });

    it('should reject duplicate response submission with same email on same form', async () => {
      const firstRes = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'unique@example.com',
          answers: { '1': ['Team One'], '2': ['AI/ML'] },
        },
      });
      assert.equal(firstRes.status, 201);

      const secondRes = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'unique@example.com',
          answers: { '1': ['Team Two'], '2': ['Web Arch'] },
        },
      });
      assert.equal(secondRes.status, 400);
      assert.equal(secondRes.body.error.code, 'INVALID_INPUT');
      assert.ok(secondRes.body.error.message.includes('already been submitted'));
    });

    it('should reject response when required question is missing with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user2@example.com',
          answers: { '2': ['AI/ML'] },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('required'));
    });

    it('should reject textual response exceeding max_len policy with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user3@example.com',
          answers: {
            '1': ['This Team Name Exceeds The Twenty Character Max Length'],
            '2': ['AI/ML'],
          },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('maximum length'));
    });

    it('should reject multiple answers when Single choice is required with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user4@example.com',
          answers: {
            '1': ['Team Code'],
            '2': ['AI/ML', 'Web Arch'],
          },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('single choice'));
    });

    it('should reject unlisted multiple choice option with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user5@example.com',
          answers: {
            '1': ['Team Code'],
            '2': ['Unallowed Track Option'],
          },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('Invalid option'));
    });

    it('should reject file upload answer with unsupported file extension with 400 Bad Request', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'user6@example.com',
          answers: {
            '1': ['Team Code'],
            '2': ['AI/ML'],
            '3': ['https://example.com/malicious.exe'],
          },
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
      assert.ok(res.body.error.message.includes('supported file type'));
    });

    it('should successfully accept valid response submission from anonymous public user', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: {
          email: 'anon@example.com',
          answers: {
            '1': ['Team Binary'],
            '2': ['Web Arch'],
            '3': ['https://example.com/doc.pdf'],
          },
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.response_id);
      assert.equal(res.body.data.form_id, formId);
      assert.equal(res.body.data.email, 'anon@example.com');
    });

    it('should successfully accept valid response from logged-in member and attach member_id and email', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        token: memberToken,
        body: {
          email: 'member@example.com',
          answers: {
            '1': ['Team Cyber'],
            '2': ['Cybersecurity'],
          },
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.response_id);
      assert.equal(res.body.data.email, 'member@example.com');
    });
  });

  describe('GET /api/v1/forms/:form_id/responses/check (Check Response Existence)', () => {
    let formId;

    beforeEach(async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      formId = createRes.body.data.form_id;

      await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: { email: 'exists@example.com', answers: { '1': ['Team Exists'], '2': ['AI/ML'] } },
      });
    });

    it('should return exists: true when response exists for email', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses/check?email=exists@example.com`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.exists, true);
      assert.equal(res.body.data.email, 'exists@example.com');
    });

    it('should return exists: false when response does not exist for email', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses/check?email=notexists@example.com`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.exists, false);
      assert.equal(res.body.data.email, 'notexists@example.com');
    });

    it('should return 400 Bad Request when email query parameter is missing', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses/check`);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_INPUT');
    });
  });

  describe('GET /api/v1/forms/:form_id/responses (Get All Form Responses)', () => {
    let formId;

    beforeEach(async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      if (!createRes.body || !createRes.body.data) {
        throw new Error(`Failed to create form in beforeEach: ${JSON.stringify(createRes.body)}`);
      }
      formId = createRes.body.data.form_id;

      await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        token: memberToken,
        body: { email: 'm1@example.com', answers: { '1': ['Team 1'], '2': ['AI/ML'] } },
      });
      await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: { email: 'm2@example.com', answers: { '1': ['Team 2'], '2': ['Web Arch'] } },
      });
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`);
      assert.equal(res.status, 401);
    });

    it('should reject forbidden role (marketing_team) with 403 Forbidden', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        token: forbiddenToken,
      });
      assert.equal(res.status, 403);
    });

    it('should return 404 Not Found for non-existent form_id', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999/responses', {
        token: eventTeamToken,
      });
      assert.equal(res.status, 404);
    });

    it('should return list of responses for authorized event_team role', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses`, {
        token: eventTeamToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.form_id, formId);
      assert.equal(res.body.data.total_responses, 2);
      assert.equal(res.body.data.responses.length, 2);
    });
  });

  describe('GET /api/v1/forms/:form_id/responses/:response_id (Get Single Response)', () => {
    let formId;
    let responseId;

    beforeEach(async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      if (!createRes.body || !createRes.body.data) {
        throw new Error(`Failed to create form in beforeEach: ${JSON.stringify(createRes.body)}`);
      }
      formId = createRes.body.data.form_id;

      const subRes = await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        token: memberToken,
        body: { email: 'solo@example.com', answers: { '1': ['Solo Team'], '2': ['AI/ML'] } },
      });
      responseId = subRes.body.data.response_id;
    });

    it('should return 404 Not Found for non-existent response_id', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses/66b64f9e1234567890999999`, {
        token: eventTeamToken,
      });
      assert.equal(res.status, 404);
    });

    it('should return single response detail for authorized event_team', async () => {
      const res = await request(`/api/v1/forms/${formId}/responses/${responseId}`, {
        token: eventTeamToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.response_id, responseId);
      assert.equal(res.body.data.form_id, formId);
      assert.equal(res.body.data.member_id, MEMBER_ID);
      assert.equal(res.body.data.email, 'solo@example.com');
      assert.deepEqual(res.body.data.answers['1'], ['Solo Team']);
    });
  });

  describe('DELETE /api/v1/forms/:form_id (Delete Form & Cascade Deletion)', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999', {
        method: 'DELETE',
      });
      assert.equal(res.status, 401);
    });

    it('should reject forbidden role with 403', async () => {
      const res = await request('/api/v1/forms/66b64f9e1234567890999999', {
        method: 'DELETE',
        token: forbiddenToken,
      });
      assert.equal(res.status, 403);
    });

    it('should delete form, questions, and responses cleanly (cascade delete)', async () => {
      const createRes = await request('/api/v1/forms', {
        method: 'POST',
        token: eventTeamToken,
        body: getValidFormPayload(),
      });
      const formId = createRes.body.data.form_id;

      await request(`/api/v1/forms/${formId}/responses`, {
        method: 'POST',
        body: { email: 'delta@example.com', answers: { '1': ['Team Delta'], '2': ['AI/ML'] } },
      });

      const deleteRes = await request(`/api/v1/forms/${formId}`, {
        method: 'DELETE',
        token: eventTeamToken,
      });

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.success, true);

      const getFormRes = await request(`/api/v1/forms/${formId}`);
      assert.equal(getFormRes.status, 404);

      const getRespRes = await request(`/api/v1/forms/${formId}/responses`, {
        token: eventTeamToken,
      });
      assert.equal(getRespRes.status, 404);
    });
  });
});
