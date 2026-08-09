import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { MemberModel } from './member.model.js';
import { config } from '../../shared/config/index.js';
import { MEMBER_STATUS, ROLES } from '../../shared/constants/index.js';
import { sendOnboardingEmail } from '../../shared/utils/mailer.js';
import { uploadProfilePhoto, replaceUploadedFile } from '../../shared/utils/fileUpload.js';
import { NotFoundError, UnauthorizedError, ConflictError, ValidationError } from '../../shared/errors/index.js';
import {
  validateTeamAndPosition,
  getRolesByTeamAndPosition,
  isInternalTeam,
} from './teamHierarchy.service.js';

export class IAMInternalService {
  static async registerMember(data, file = null) {
    const existing = await MemberModel.findOne({ email: data.email });
    if (existing) {
      throw new ConflictError('A member with this email already exists.');
    }

    const { canonicalTeam, canonicalPosition } = validateTeamAndPosition(data.team, data.position);
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

    // Send onboarding email notification
    await sendOnboardingEmail({
      email: member.email,
      token: onboardingToken,
      name: member.name,
    });

    return member.toJSON();
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

    const updateFields = { ...updates };

    if (currentUser && !currentUser.roles.includes('admin')) {
      // Non-admin members cannot update restricted admin fields
      delete updateFields.status;
      delete updateFields.roles;
      delete updateFields.email;
      delete updateFields.team;
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

