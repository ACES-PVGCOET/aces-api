import fs from 'fs';
import path from 'path';
import { ROLES } from '../../../shared/constants/index.js';

// Default static rules fallback
const DEFAULT_AUTHORITIES = {
  '*.*': [ROLES.ADMIN],
  'members.*': [ROLES.ADMIN],
  'events.*': [ROLES.EVENT_TEAM],
  'announcements.*': [ROLES.MARKETING_TEAM],
  'forms.*': [ROLES.EVENT_TEAM, ROLES.EDITORIAL_TEAM],
  'gallery.*': [ROLES.MEDIA_TEAM, ROLES.EDITORIAL_TEAM],
  '*.read': ['*'],
};

/**
 * Loads and parses authorities.json config file
 */
export function loadAuthorities() {
  try {
    const filePath = path.resolve(process.cwd(), 'authorities.json');
    if (!fs.existsSync(filePath)) {
      return DEFAULT_AUTHORITIES;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed.authorities || DEFAULT_AUTHORITIES;
  } catch (_e) {
    return DEFAULT_AUTHORITIES;
  }
}

/**
 * Parses an authority input (e.g. 'events.create' or { resource: 'events', action: 'create' })
 */
export function parseAuthorityInput(input) {
  if (typeof input === 'string') {
    const parts = input.split('.');
    const resource = parts[0] ? parts[0].trim().toLowerCase() : '*';
    const action = parts[1] ? parts[1].trim().toLowerCase() : '*';
    return { resource, action };
  } else if (input && typeof input === 'object') {
    const resource = (input.resource || '*').trim().toLowerCase();
    const action = (input.action || '*').trim().toLowerCase();
    return { resource, action };
  }
  return { resource: '*', action: '*' };
}

/**
 * Resolves required roles for a given resource and action based on authorities pattern matching
 */
export function getRolesForAuthority(authorityInput) {
  const { resource, action } = parseAuthorityInput(authorityInput);
  const rules = loadAuthorities();
  const allowedRoles = new Set();

  // Pattern matching keys
  const exactKey = `${resource}.${action}`;
  const resourceWildcardKey = `${resource}.*`;
  const actionWildcardKey = `*.${action}`;
  const globalWildcardKey = '*.*';

  // Check exact key
  if (rules[exactKey]) {
    rules[exactKey].forEach((r) => allowedRoles.add(r));
  }
  // Check resource wildcard key (e.g. events.*)
  if (rules[resourceWildcardKey]) {
    rules[resourceWildcardKey].forEach((r) => allowedRoles.add(r));
  }
  // Check action wildcard key (e.g. *.read)
  if (rules[actionWildcardKey]) {
    rules[actionWildcardKey].forEach((r) => allowedRoles.add(r));
  }
  // Check global wildcard key (*.*)
  if (rules[globalWildcardKey]) {
    rules[globalWildcardKey].forEach((r) => allowedRoles.add(r));
  }

  return Array.from(allowedRoles);
}

/**
 * Evaluates whether user's roles satisfy required authority
 */
export function hasAuthority(userRoles, authorityInput) {
  const userRoleArray = Array.isArray(userRoles) ? userRoles : [];
  const requiredRoles = getRolesForAuthority(authorityInput);

  // Wildcard '*' allows everyone
  if (requiredRoles.includes('*')) {
    return true;
  }

  // Admin bypass
  if (userRoleArray.includes(ROLES.ADMIN) || userRoleArray.includes('admin')) {
    return true;
  }

  // Check intersection of user roles and required roles
  return userRoleArray.some((role) => requiredRoles.includes(role));
}
