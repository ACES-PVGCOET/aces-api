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

    it('should successfully register members under Event Team, Events Team, Design Team, and DnP Team aliases', async () => {
      const mockCsvContent = `Name, Email, Team, Position
Eve Event, eve.event@aces.org, Event Team, Member
Evan Events, evan.events@aces.org, Events Team, Head
Desi Design, desi.design@aces.org, Design Team, Member
Don DnP, don.dnp@aces.org, DnP Team, Joint Head`;

      mockExternalFetch(async () => ({
        ok: true,
        text: async () => mockCsvContent,
      }));

      const res = await request('/api/v1/iam/bulk-register', {
        method: 'POST',
        token: adminToken,
        body: { sheet_url: 'https://docs.google.com/spreadsheets/d/e/2PACX-teams/pub?output=csv' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.total, 4);
      assert.equal(res.body.data.successfulCount, 4);
      assert.equal(res.body.data.failedCount, 0);

      assert.equal(res.body.data.successful[0].team, 'Event Team');
      assert.ok(res.body.data.successful[0].roles.includes('event_team'));

      assert.equal(res.body.data.successful[1].team, 'Event Team');
      assert.ok(res.body.data.successful[1].roles.includes('event_team'));

      assert.equal(res.body.data.successful[2].team, 'Design Team');
      assert.ok(res.body.data.successful[2].roles.includes('design_team'));

      assert.equal(res.body.data.successful[3].team, 'DnP Team');
      assert.ok(res.body.data.successful[3].roles.includes('design_team'));
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

  describe('Cookie-Based Authentication & Session Endpoints', () => {
    it('should login member, set HTTP-only cookie, and NOT return token in response body', async () => {
      // 1. Create a member to test login
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Session Test User',
          email: 'session.test@aces.org',
          team: 'Web Team',
          position: 'Head',
        },
      });

      const { MemberModel } = await import('../iam/internal/member.model.js');
      const createdMember = await MemberModel.findOne({ email: 'session.test@aces.org' }).select('+onboarding_token');
      assert.ok(createdMember);
      assert.ok(createdMember.onboarding_token);

      await request('/api/v1/iam/onboard', {
        method: 'POST',
        body: {
          token: createdMember.onboarding_token,
          password: 'TestPassword123!',
        },
      });

      // 2. Perform Login
      const loginRes = await request('/api/v1/iam/login', {
        method: 'POST',
        body: {
          email: 'session.test@aces.org',
          password: 'TestPassword123!',
        },
      });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.success, true);
      assert.ok(loginRes.body.data.member);
      assert.equal(loginRes.body.data.token, undefined, 'Token MUST NOT be present in JSON response body');
    });

    it('should return current member profile on GET /api/v1/iam/me', async () => {
      const res = await request('/api/v1/iam/me', {
        method: 'GET',
        token: adminToken,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('should successfully clear auth session on POST /api/v1/iam/logout', async () => {
      const res = await request('/api/v1/iam/logout', {
        method: 'POST',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.data.message, /Logged out successfully/i);
    });
  });

  describe('Team Admin Role Authorization & Team Scoping', () => {
    let webTeamAdminToken;
    let webTeamMemberId;

    beforeEach(async () => {
      webTeamAdminToken = generateTestToken({
        id: 'web-admin-id-123',
        roles: ['team_admin', 'web_team'],
        team: 'Web Team',
      });

      // Register a web team member
      const regRes = await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Web Team Member',
          email: 'web.member@aces.org',
          team: 'Web Team',
          position: 'Member',
        },
      });
      webTeamMemberId = regRes.body.data.id;
    });

    it('should allow team_admin to register a member belonging to their own team', async () => {
      const res = await request('/api/v1/iam/register', {
        method: 'POST',
        token: webTeamAdminToken,
        body: {
          name: 'New Web Recruit',
          email: 'new.web@aces.org',
          team: 'Web Team',
          position: 'Member',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.team, 'Web Team');
    });

    it('should reject team_admin registering a member for a different team with 403 Forbidden', async () => {
      const res = await request('/api/v1/iam/register', {
        method: 'POST',
        token: webTeamAdminToken,
        body: {
          name: 'Media Recruit',
          email: 'media.recruit@aces.org',
          team: 'Media Team',
          position: 'Member',
        },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error.message, /Team admins can only register members for their own team/i);
    });

    it('should allow team_admin to update a member of their own team', async () => {
      const res = await request(`/api/v1/iam/members/${webTeamMemberId}`, {
        method: 'PUT',
        token: webTeamAdminToken,
        body: {
          name: 'Updated Web Member Name',
          position: 'Head',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.name, 'Updated Web Member Name');
    });

    it('should strip roles and status updates when team_admin attempts to modify them', async () => {
      const res = await request(`/api/v1/iam/members/${webTeamMemberId}`, {
        method: 'PUT',
        token: webTeamAdminToken,
        body: {
          roles: ['admin'],
          status: 'ACTIVE',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      // Status should remain NOT_ACTIVE and admin role MUST NOT be assigned
      assert.equal(res.body.data.status, 'NOT_ACTIVE');
      assert.equal(res.body.data.roles.includes('admin'), false);
    });

    it('should allow true admin to update member roles and status', async () => {
      const res = await request(`/api/v1/iam/members/${webTeamMemberId}`, {
        method: 'PUT',
        token: adminToken,
        body: {
          roles: ['team_admin', 'web_team'],
          status: 'ACTIVE',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'ACTIVE');
      assert.ok(res.body.data.roles.includes('team_admin'));
    });
  });

  describe('Faculty Roles, Team Request Aliases & Role Sorting Tests', () => {
    it('should validate and register Faculty members with Head of Department and Faculty Coordinator positions', async () => {
      const hodRes = await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Dr. HOD User',
          email: 'hod@aces.org',
          team: 'Faculty',
          position: 'Head of Department',
        },
      });
      assert.equal(hodRes.status, 201);
      assert.equal(hodRes.body.data.position, 'Head Of Department');

      const coordRes = await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Prof. Coordinator',
          email: 'coord@aces.org',
          team: 'Faculty',
          position: 'Faculty Coordinator',
        },
      });
      assert.equal(coordRes.status, 201);
      assert.equal(coordRes.body.data.position, 'Faculty Coordinator');
    });

    it('should resolve team requests for treasury & sponsorship team -> treasury team and media & marketing team -> media team', async () => {
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Treasury Lead',
          email: 'treasury.lead@aces.org',
          team: 'Treasury Team',
          position: 'Head',
        },
      });

      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Media Lead',
          email: 'media.lead@aces.org',
          team: 'Media Team',
          position: 'Head',
        },
      });

      const treasuryRes = await request('/api/v1/iam/members?team=treasury and sponsorship team', {
        method: 'GET',
      });
      assert.equal(treasuryRes.status, 200);
      assert.ok(treasuryRes.body.data.members.length >= 1);
      assert.equal(treasuryRes.body.data.members[0].email, 'treasury.lead@aces.org');

      const mediaRes = await request('/api/v1/iam/members?team=media and marketing team', {
        method: 'GET',
      });
      assert.equal(mediaRes.status, 200);
      assert.ok(mediaRes.body.data.members.length >= 1);
      assert.equal(mediaRes.body.data.members[0].email, 'media.lead@aces.org');
    });

    it('should return team members in sorted order according to role ranks', async () => {
      // Register Web Team members out of order
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Web Member',
          email: 'web.member.sort@aces.org',
          team: 'Web Team',
          position: 'Member',
        },
      });
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Web Head',
          email: 'web.head.sort@aces.org',
          team: 'Web Team',
          position: 'Head',
        },
      });
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Web Joint Head',
          email: 'web.jointhead.sort@aces.org',
          team: 'Web Team',
          position: 'Joint Head',
        },
      });

      const webRes = await request('/api/v1/iam/members?team=Web Team', {
        method: 'GET',
      });
      assert.equal(webRes.status, 200);
      const webMembers = webRes.body.data.members;
      assert.equal(webMembers.length, 3);
      assert.equal(webMembers[0].position, 'Head');
      assert.equal(webMembers[1].position, 'Joint Head');
      assert.equal(webMembers[2].position, 'Member');

      // Register Leaders out of order
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Joint Gen Sec',
          email: 'jgs@aces.org',
          team: 'Leaders',
          position: 'Joint General Secretary',
        },
      });
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Gen Sec',
          email: 'gs@aces.org',
          team: 'Leaders',
          position: 'General Secretary',
        },
      });

      const leadersRes = await request('/api/v1/iam/members?team=Leaders', {
        method: 'GET',
      });
      assert.equal(leadersRes.status, 200);
      const leaderMembers = leadersRes.body.data.members;
      assert.equal(leaderMembers.length, 2);
      assert.equal(leaderMembers[0].position, 'General Secretary');
      assert.equal(leaderMembers[1].position, 'Joint General Secretary');

      // Register Faculty out of order
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Faculty Coord',
          email: 'fc.sort@aces.org',
          team: 'Faculty',
          position: 'Faculty Coordinator',
        },
      });
      await request('/api/v1/iam/register', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Faculty HOD',
          email: 'hod.sort@aces.org',
          team: 'Faculty',
          position: 'Head of Department',
        },
      });

      const facultyRes = await request('/api/v1/iam/members?team=Faculty', {
        method: 'GET',
      });
      assert.equal(facultyRes.status, 200);
      const facultyMembers = facultyRes.body.data.members;
      assert.equal(facultyMembers.length, 2);
      assert.equal(facultyMembers[0].position, 'Head Of Department');
      assert.equal(facultyMembers[1].position, 'Faculty Coordinator');
    });
  });
});


