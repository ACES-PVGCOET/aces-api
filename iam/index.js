import { IAMInternalService } from './internal/iam.service.internal.js';
import {
  validateTeamAndPosition,
  getRolesByTeamAndPosition,
  isInternalTeam,
} from './internal/teamHierarchy.service.js';
import {
  hasAuthority,
  getRolesForAuthority,
  loadAuthorities,
} from '../orchestration/http/middleware/authorityManager.js';

/**
 * PUBLIC INTERFACE FOR IAM DOMAIN MODULE
 * Exposed to other domain modules and orchestration layer.
 * DO NOT import directly from iam/internal/* in other modules.
 */
export const IAMService = {
  /**
   * Verifies JWT token string and returns decoded payload
   */
  verifyToken: (token) => IAMInternalService.verifyToken(token),

  /**
   * Retrieves member profile by ID
   */
  getMemberById: (id) => IAMInternalService.getMemberById(id),

  /**
   * Gets roles and permissions for a member
   */
  getUserPermissions: async (id) => {
    const member = await IAMInternalService.getMemberById(id);
    return member ? member.roles : [];
  },

  /**
   * Admin registers new member
   */
  registerMember: (data) => IAMInternalService.registerMember(data),

  /**
   * Complete member onboarding with token & password
   */
  completeOnboarding: (data) => IAMInternalService.completeOnboarding(data),

  /**
   * Seeds initial admin member if not present in database
   */
  seedInitialAdmin: () => IAMInternalService.seedInitialAdmin(),

  /**
   * Validates team and position hierarchy
   */
  validateTeamAndPosition: (team, position) => validateTeamAndPosition(team, position),

  /**
   * Dynamically fetches roles based on team and position
   */
  getRolesByTeamAndPosition: (team, position) => getRolesByTeamAndPosition(team, position),

  /**
   * Checks if team is internal only
   */
  isInternalTeam: (team) => isInternalTeam(team),

  /**
   * Checks if roles satisfy authority pattern
   */
  hasAuthority: (userRoles, authorityInput) => hasAuthority(userRoles, authorityInput),

  /**
   * Resolves required roles for authority pattern
   */
  getRolesForAuthority: (authorityInput) => getRolesForAuthority(authorityInput),

  /**
   * Gets loaded authority rules object
   */
  getAuthorityRules: () => loadAuthorities(),
};

export default IAMService;


