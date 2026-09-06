import { MembershipInternalService } from '../internal/membership.service.internal.js';
import { sendSuccess } from '../../shared/utils/responseFormatter.js';
import { ValidationError } from '../../shared/errors/index.js';

export const listMemberships = async (req, res, next) => {
  try {
    const { status, class: className, payment_mode, search, page, limit, sort_by } = req.query;
    const result = await MembershipInternalService.listMemberships({
      status,
      className,
      paymentMode: payment_mode,
      search,
      page,
      limit,
      sortBy: sort_by,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getStats = async (_req, res, next) => {
  try {
    const stats = await MembershipInternalService.getStatistics();
    return sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

export const getMembershipById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await MembershipInternalService.getMembershipById(id);
    return sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
};

export const createMembership = async (req, res, next) => {
  try {
    const data = req.body;
    const file = req.file || null;
    const created = await MembershipInternalService.createMembership(data, file);
    return sendSuccess(res, created, 201);
  } catch (error) {
    next(error);
  }
};

export const verifyMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const updated = await MembershipInternalService.verifyMembership(id, payload, req.user || null);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
};

export const updateMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await MembershipInternalService.updateMembership(id, updates);
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
};

export const deleteMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await MembershipInternalService.deleteMembership(id);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const bulkImportMemberships = async (req, res, next) => {
  try {
    const { records } = req.body;
    const result = await MembershipInternalService.bulkImport(records, 'api_bulk_import');
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const importLocalSheet = async (req, res, next) => {
  try {
    const filePath = req.body?.file_path;
    if (!filePath) {
      throw new ValidationError('A valid file_path pointing to the spreadsheet is required.');
    }
    const result = await MembershipInternalService.importFromLocalExcel(filePath);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
