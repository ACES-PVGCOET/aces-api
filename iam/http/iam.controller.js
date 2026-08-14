import { IAMInternalService } from '../internal/iam.service.internal.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { ValidationError, ForbiddenError } from '../../shared/errors/index.js';

export const registerMember = asyncHandler(async (req, res) => {
  const { email, team, position } = req.body;
  if (!email || !team || !position) {
    throw new ValidationError('Email, team, and position are required fields.');
  }

  const result = await IAMInternalService.registerMember(req.body, req.file);
  return sendSuccess(res, result, 201);
});

export const bulkRegisterMembers = asyncHandler(async (req, res) => {
  const sheetUrl = req.body.sheet_url || req.body.url || req.body.sheetUrl;
  if (!sheetUrl) {
    throw new ValidationError('Google Sheet URL is required.');
  }

  const result = await IAMInternalService.bulkRegisterMembers(sheetUrl);
  return sendSuccess(res, result, 201);
});

export const completeOnboarding = asyncHandler(async (req, res) => {
  const { token, password, name } = req.body;
  if (!token || !password) {
    throw new ValidationError('Onboarding token and password are required.');
  }

  const result = await IAMInternalService.completeOnboarding({ token, password, name });
  return sendSuccess(res, result);
});

export const loginMember = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ValidationError('Email and password are required.');
  }

  const { member, token } = await IAMInternalService.loginMember(email, password);

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return sendSuccess(res, { member });
});

export const getMemberById = asyncHandler(async (req, res) => {
  const member = await IAMInternalService.getMemberById(req.params.id);
  return sendSuccess(res, member);
});

export const listMembers = asyncHandler(async (req, res) => {
  const members = await IAMInternalService.listMembers(req.query);
  return sendSuccess(res, { members });
});

export const updateMember = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const isSelf = req.user && req.user.id === targetId;
  const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');

  if (!isSelf && !isAdmin) {
    throw new ForbiddenError('You can only update your own profile.');
  }

  const updatedMember = await IAMInternalService.updateMember(targetId, req.body, req.user, req.file);
  return sendSuccess(res, updatedMember);
});

export const deleteMember = asyncHandler(async (req, res) => {
  const result = await IAMInternalService.deleteMember(req.params.id);
  return sendSuccess(res, result);
});

