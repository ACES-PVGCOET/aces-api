import { MembershipInternalService } from './internal/membership.service.internal.js';
import {
  MembershipModel,
  MembershipSyncMetaModel,
  MEMBERSHIP_STATUS,
  PAYMENT_MODES,
  RECEIPT_STATUS,
} from './internal/membership.model.js';

export const MembershipService = {
  listMemberships: MembershipInternalService.listMemberships.bind(MembershipInternalService),
  getMembershipById: MembershipInternalService.getMembershipById.bind(MembershipInternalService),
  getIdCardByMembershipNumber: MembershipInternalService.getIdCardByMembershipNumber.bind(MembershipInternalService),
  createMembership: MembershipInternalService.createMembership.bind(MembershipInternalService),
  verifyMembership: MembershipInternalService.verifyMembership.bind(MembershipInternalService),
  updateMembership: MembershipInternalService.updateMembership.bind(MembershipInternalService),
  deleteMembership: MembershipInternalService.deleteMembership.bind(MembershipInternalService),
  bulkImport: MembershipInternalService.bulkImport.bind(MembershipInternalService),
  importFromLocalExcel: MembershipInternalService.importFromLocalExcel.bind(MembershipInternalService),
  getStatistics: MembershipInternalService.getStatistics.bind(MembershipInternalService),
  getSyncStatus: MembershipInternalService.getSyncStatus.bind(MembershipInternalService),
  syncFromForm: MembershipInternalService.syncFromForm.bind(MembershipInternalService),
  resendMembershipEmail: MembershipInternalService.resendMembershipEmail.bind(MembershipInternalService),
};

export { MembershipModel, MembershipSyncMetaModel, MEMBERSHIP_STATUS, PAYMENT_MODES, RECEIPT_STATUS };
export default MembershipService;

