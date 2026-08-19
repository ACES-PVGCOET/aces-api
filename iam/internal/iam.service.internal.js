import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MemberModel } from './member.model.js';
import { config } from '../../shared/config/index.js';
import { MEMBER_STATUS, ROLES } from '../../shared/constants/index.js';
import { sendOnboardingEmail } from '../../shared/utils/mailer.js';
import { uploadProfilePhoto, replaceUploadedFile } from '../../shared/utils/fileUpload.js';
import { NotFoundError, UnauthorizedError, ConflictError, ValidationError, ForbiddenError } from '../../shared/errors/index.js';
import {
  validateTeamAndPosition,
  getRolesByTeamAndPosition,
  isInternalTeam,
} from './teamHierarchy.service.js';

export class IAMInternalService {
  static async registerMember(data, file = null, currentUser = null) {
    const existing = await MemberModel.findOne({ email: data.email });
    if (existing) {
      throw new ConflictError('A member with this email already exists.');
    }

    const { canonicalTeam, canonicalPosition } = validateTeamAndPosition(data.team, data.position);

    if (currentUser) {
      const isAdmin = currentUser.roles?.includes(ROLES.ADMIN) || currentUser.roles?.includes('admin');
      const isTeamAdmin = currentUser.roles?.includes(ROLES.TEAM_ADMIN) || currentUser.roles?.includes('team_admin');

      if (isTeamAdmin && !isAdmin) {
        if (!currentUser.team || canonicalTeam.toLowerCase() !== currentUser.team.toLowerCase()) {
          throw new ForbiddenError(`Team admins can only register members for their own team ('${currentUser.team}').`);
        }
      }
    }

    const dynamicRoles = getRolesByTeamAndPosition(canonicalTeam, canonicalPosition);

    const memberData = {
      ...data,
      team: canonicalTeam,
      position: canonicalPosition,
    };

    if (Array.isArray(memberData.roles) && memberData.roles.length > 0) {
      const mergedRoles = new Set([...dynamicRoles, ...memberData.roles]);
      memberData.roles = Array.from(mergedRoles);
    } else {
      memberData.roles = dynamicRoles;
    }

    // Strip administrative roles if created by a non-admin team_admin
    if (currentUser) {
      const isAdmin = currentUser.roles?.includes(ROLES.ADMIN) || currentUser.roles?.includes('admin');
      if (!isAdmin) {
        memberData.roles = memberData.roles.filter((r) => r !== ROLES.ADMIN && r !== 'admin' && r !== ROLES.TEAM_ADMIN && r !== 'team_admin');
      }
    }

    if (typeof memberData.social_links === 'string') {
      try {
        memberData.social_links = JSON.parse(memberData.social_links);
      } catch (_e) {
        // Fallback if social_links parsing fails
      }
    }

    if (file) {
      const uploadResult = await uploadProfilePhoto(file);
      memberData.profile_photo_url = uploadResult.secureUrl;
    }

    const onboardingToken = crypto.randomBytes(32).toString('hex');
    const onboardingTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const member = await MemberModel.create({
      ...memberData,
      status: MEMBER_STATUS.NOT_ACTIVE,
      onboarding_token: onboardingToken,
      onboarding_token_expires_at: onboardingTokenExpiresAt,
    });

    // Send onboarding email notification (safeguarded against mail delivery / timeout errors)
    try {
      await sendOnboardingEmail({
        email: member.email,
        token: onboardingToken,
        name: member.name,
      });
    } catch (emailErr) {
      console.error(`[IAM] Failed to dispatch onboarding email to ${member.email}:`, emailErr.message);
    }

    return {
      ...member.toJSON(),
      onboarding_token: onboardingToken,
    };
  }

  static async completeOnboarding({ token, password, name }) {
    if (!token || !password) {
      throw new ValidationError('Onboarding token and password are required.');
    }

    const member = await MemberModel.findOne({
      onboarding_token: token,
      onboarding_token_expires_at: { $gt: new Date() },
    }).select('+onboarding_token +onboarding_token_expires_at +password');

    if (!member) {
      throw new ValidationError('Invalid or expired onboarding token.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    member.password = hashedPassword;
    member.status = MEMBER_STATUS.ACTIVE;
    member.onboarding_token = undefined;
    member.onboarding_token_expires_at = undefined;

    if (name) {
      member.name = name;
    }

    await member.save();
    return member.toJSON();
  }

  static async loginMember(email, password) {
    const member = await MemberModel.findOne({ email }).select('+password');
    if (!member) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (member.status === MEMBER_STATUS.NOT_ACTIVE) {
      throw new UnauthorizedError('Account is not activated yet. Please complete onboarding via email link.');
    }

    if (!member.password) {
      throw new UnauthorizedError('Account password is not set. Please complete onboarding.');
    }

    const isMatch = await bcrypt.compare(password, member.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const payload = {
      id: member._id.toString(),
      email: member.email,
      roles: member.roles,
      team: member.team,
      position: member.position,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return {
      member: member.toJSON(),
      token,
    };
  }

  static async getMemberById(id) {
    const member = await MemberModel.findById(id);
    if (!member || isInternalTeam(member.team)) {
      throw new NotFoundError(`Member with ID '${id}' not found.`);
    }
    return member.toJSON();
  }

  static async listMembers(filters = {}) {
    const query = {
      team: { $nin: [/Executive/i] },
    };
    if (filters.team) {
      query.team = new RegExp(filters.team, 'i');
    }
    if (filters.status) {
      query.status = filters.status;
    }
    const members = await MemberModel.find(query);
    return members.map((m) => m.toJSON());
  }

  static async updateMember(id, updates, currentUser = null, file = null) {
    const member = await MemberModel.findById(id);
    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found.`);
    }

    const isAdmin = currentUser?.roles?.includes(ROLES.ADMIN) || currentUser?.roles?.includes('admin');
    const isTeamAdmin = currentUser?.roles?.includes(ROLES.TEAM_ADMIN) || currentUser?.roles?.includes('team_admin');
    const isSelf = currentUser && currentUser.id === id;
    const isSameTeam = currentUser?.team && member.team && currentUser.team.trim().toLowerCase() === member.team.trim().toLowerCase();

    if (currentUser && !isAdmin && !isSelf && !(isTeamAdmin && isSameTeam)) {
      throw new ForbiddenError('You do not have permission to update this member.');
    }

    const updateFields = { ...updates };

    if (currentUser && !isAdmin) {
      // Non-admin members (including team_admin) cannot update roles, status, or email
      delete updateFields.status;
      delete updateFields.roles;
      delete updateFields.email;

      if (isTeamAdmin && updateFields.team) {
        const { canonicalTeam } = validateTeamAndPosition(updateFields.team, updateFields.position || member.position);
        if (canonicalTeam.toLowerCase() !== currentUser.team.toLowerCase()) {
          throw new ForbiddenError(`Team admins can only assign members to their own team ('${currentUser.team}').`);
        }
      } else if (!isAdmin) {
        delete updateFields.team;
      }
    }

    if (updateFields.team || updateFields.position) {
      const targetTeam = updateFields.team || member.team;
      const targetPosition = updateFields.position || member.position;
      const { canonicalTeam, canonicalPosition } = validateTeamAndPosition(targetTeam, targetPosition);
      updateFields.team = canonicalTeam;
      updateFields.position = canonicalPosition;

      if (!updateFields.roles) {
        updateFields.roles = getRolesByTeamAndPosition(canonicalTeam, canonicalPosition);
      }
    }

    if (typeof updateFields.social_links === 'string') {
      try {
        updateFields.social_links = JSON.parse(updateFields.social_links);
      } catch (_e) {
        // Fallback if social_links parsing fails
      }
    }

    if (file) {
      const uploadResult = await replaceUploadedFile(file, member.profile_photo_url, {
        folder: 'aces/profile_photos',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });
      updateFields.profile_photo_url = uploadResult.secureUrl;
    }

    if (updateFields.password) {
      updateFields.password = await bcrypt.hash(updateFields.password, 10);
    }

    Object.assign(member, updateFields);
    await member.save();

    return member.toJSON();
  }

  static async deleteMember(id) {
    const member = await MemberModel.findByIdAndDelete(id);
    if (!member) {
      throw new NotFoundError(`Member with ID '${id}' not found.`);
    }
    return { message: 'Member successfully removed.' };
  }

  static async bulkRegisterMembers(sheetUrl, currentUser = null) {
    if (!sheetUrl || typeof sheetUrl !== 'string' || !sheetUrl.trim()) {
      throw new ValidationError('Google Sheet URL is required.');
    }

    let formattedUrl;
    try {
      const parsed = new URL(sheetUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      formattedUrl = formatGoogleSheetCsvUrl(sheetUrl.trim());
    } catch (_e) {
      throw new ValidationError('Invalid Google Sheet URL format.');
    }

    let csvText;
    try {
      const response = await fetch(formattedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      csvText = await response.text();
    } catch (err) {
      throw new ValidationError(`Failed to fetch Google Sheet from URL: ${err.message}`);
    }

    if (csvText.toLowerCase().includes('<!doctype html>') || csvText.toLowerCase().includes('<html')) {
      throw new ValidationError('Unable to fetch CSV content from Google Sheet. Ensure the Google Sheet is published to the web in CSV format.');
    }

    const records = parseCSV(csvText);
    if (!records || records.length === 0) {
      throw new ValidationError('The provided CSV sheet is empty or contains no records.');
    }

    const firstRecord = records[0];
    if (!('email' in firstRecord) || !('team' in firstRecord) || !('position' in firstRecord)) {
      throw new ValidationError('CSV sheet header must include email, team, and position columns.');
    }

    const successful = [];
    const failed = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // Line 1 is header
      const { name = '', email = '', team = '', position = '' } = row;

      if (!email.trim()) {
        failed.push({ row: rowNum, email: '', reason: 'Email is required.' });
        continue;
      }
      if (!team.trim()) {
        failed.push({ row: rowNum, email: email.trim(), reason: 'Team is required.' });
        continue;
      }
      if (!position.trim()) {
        failed.push({ row: rowNum, email: email.trim(), reason: 'Position is required.' });
        continue;
      }

      try {
        const registered = await this.registerMember(
          {
            name: name.trim(),
            email: email.trim(),
            team: team.trim(),
            position: position.trim(),
          },
          null,
          currentUser
        );
        successful.push(registered);
      } catch (err) {
        failed.push({
          row: rowNum,
          email: email.trim(),
          reason: err.message,
        });
      }
    }

    return {
      total: records.length,
      successfulCount: successful.length,
      failedCount: failed.length,
      successful,
      failed,
    };
  }

  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded;
    } catch (_err) {
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }
  }

  static async seedInitialAdmin() {
    const adminEmail = config.admin?.email?.trim().toLowerCase();
    if (!adminEmail) {
      console.info('[Seed] No initial admin email configured in .env (INIT_ADMIN_EMAIL). Skipping admin seed.');
      return null;
    }

    const existingAdmin = await MemberModel.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.info(`[Seed] Admin member (${adminEmail}) already exists in DB.`);
      return existingAdmin.toJSON();
    }

    const rawPassword = config.admin?.password || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const newAdmin = await MemberModel.create({
      name: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      team: 'Executive',
      position: 'Administrator',
      roles: [ROLES.ADMIN, ROLES.WEB_TEAM],
      status: MEMBER_STATUS.ACTIVE,
    });

    console.info(`[Seed] Successfully seeded initial admin member: ${adminEmail}`);
    return newAdmin.toJSON();
  }
}

/**
 * Helper to auto-convert normal Google Sheet view/edit URLs to CSV export format
 */
export function formatGoogleSheetCsvUrl(sheetUrl) {
  const url = sheetUrl.trim();
  const googleSheetEditMatch = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (googleSheetEditMatch && !url.includes('/pub') && !url.includes('output=csv')) {
    const sheetId = googleSheetEditMatch[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  }
  return url;
}

/**
 * Normalizes header names to standard keys ('name', 'email', 'team', 'position')
 */
function normalizeHeaderName(h) {
  const clean = h.trim().toLowerCase();
  if (clean === 'name' || clean === 'full name' || clean === 'member name') return 'name';
  if (clean === 'email' || clean === 'email address') return 'email';
  if (clean === 'team' || clean === 'team name' || clean === 'department') return 'team';
  if (clean === 'position' || clean === 'designation' || clean === 'role') return 'position';
  return clean;
}

/**
 * Parses raw CSV text into array of record objects
 */
export function parseCSV(csvText) {
  const lines = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      inQuotes = !inQuotes;
      cur += char;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  if (cur || csvText.length > 0) {
    lines.push(cur);
  }

  const parsedRows = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const row = [];
      let cell = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const nc = line[i + 1];
        if (c === '"') {
          if (q && nc === '"') {
            cell += '"';
            i++;
          } else {
            q = !q;
          }
        } else if (c === ',' && !q) {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += c;
        }
      }
      row.push(cell.trim());
      return row;
    });

  if (parsedRows.length === 0) return [];

  const rawHeaders = parsedRows[0];
  const headers = rawHeaders.map(normalizeHeaderName);

  const records = [];
  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = row[idx] !== undefined ? row[idx] : '';
    });
    records.push(record);
  }
  return records;
}


