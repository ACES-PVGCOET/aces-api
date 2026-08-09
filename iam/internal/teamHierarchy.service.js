import fs from 'fs';
import path from 'path';
import { ROLES } from '../../shared/constants/index.js';
import { ValidationError } from '../../shared/errors/index.js';

// Default static hierarchy fallback in case teams.txt cannot be loaded
const DEFAULT_HIERARCHY = {
  'Leaders': ['General Secretary', 'Joint General Secretary'],
  'Faculty': ['Faculty'],
  'Web Team': ['Head', 'Joint Head', 'Member'],
  'Technical Team': ['Head', 'Joint Head', 'Member'],
  'Media Team': ['Head', 'Joint Head', 'Member'],
  'Marketing Team': ['Head', 'Joint Head', 'Member'],
  'Treasury Team': ['Head', 'Joint Head', 'Member'],
  'Event Team': ['Head', 'Joint Head', 'Member'],
  'DnP Team': ['Head', 'Joint Head', 'Member'],
  'Editorial Team': ['Head', 'Joint Head', 'Member'],
  'Production Team': ['Head', 'Joint Head', 'Member'],
  'Executive': ['Administrator', 'admin'],
};

// Map team names to role constants
const TEAM_ROLE_MAP = {
  'leaders': ROLES.LEADER,
  'faculty': ROLES.FACULTY,
  'web team': ROLES.WEB_TEAM,
  'technical team': ROLES.TECH_TEAM,
  'tech team': ROLES.TECH_TEAM,
  'media team': ROLES.MEDIA_TEAM,
  'marketing team': ROLES.MARKETING_TEAM,
  'treasury team': ROLES.TREASURY_TEAM,
  'event team': ROLES.EVENT_TEAM,
  'dnp team': ROLES.DNP_TEAM,
  'editorial team': ROLES.EDITORIAL_TEAM,
  'production team': ROLES.PRODUCTION_TEAM,
  'executive': ROLES.ADMIN,
  'executive team': ROLES.ADMIN,
};

// Internal teams hidden from read operations
const INTERNAL_TEAMS = ['executive', 'executive team'];

/**
 * Parses teams.txt file into a structured team-position hierarchy object
 */
export function getTeamHierarchy() {
  try {
    const filePath = path.resolve(process.cwd(), 'teams.txt');
    if (!fs.existsSync(filePath)) {
      return DEFAULT_HIERARCHY;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const hierarchy = {};
    let currentTeam = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (
        !line ||
        line.startsWith('#') ||
        line.startsWith('format:') ||
        line.toLowerCase() === 'team_name:' ||
        line.toLowerCase() === '(positions)'
      ) {
        continue;
      }

      if (line.endsWith(':')) {
        currentTeam = line.slice(0, -1).trim();
        hierarchy[currentTeam] = [];
      } else if (currentTeam && line.startsWith('(') && line.endsWith(')')) {
        const positionsStr = line.slice(1, -1);
        const positions = positionsStr.split(',').map((p) => p.trim()).filter(Boolean);
        hierarchy[currentTeam] = positions;
      }
    }

    return Object.keys(hierarchy).length > 0 ? hierarchy : DEFAULT_HIERARCHY;
  } catch (_e) {
    return DEFAULT_HIERARCHY;
  }
}

/**
 * Validates that team exists and position belongs to team hierarchy
 */
export function validateTeamAndPosition(team, position) {
  if (!team || typeof team !== 'string') {
    throw new ValidationError('Team affiliation is required.');
  }
  if (!position || typeof position !== 'string') {
    throw new ValidationError('Position is required.');
  }

  const hierarchy = getTeamHierarchy();
  const teamKeys = Object.keys(hierarchy);
  
  // Find team matching case-insensitively or via alias
  const normalizedInputTeam = team.trim().toLowerCase();
  let canonicalTeam = teamKeys.find(
    (key) => key.toLowerCase() === normalizedInputTeam
  );

  // Alias support (e.g. "Tech Team" -> "Technical Team")
  if (!canonicalTeam && normalizedInputTeam === 'tech team') {
    canonicalTeam = teamKeys.find((key) => key.toLowerCase() === 'technical team') || 'Technical Team';
  }
  if (!canonicalTeam && normalizedInputTeam === 'executive team') {
    canonicalTeam = teamKeys.find((key) => key.toLowerCase() === 'executive') || 'Executive';
  }

  if (!canonicalTeam) {
    throw new ValidationError(
      `Invalid team '${team}'. Valid teams are: ${teamKeys.join(', ')}.`
    );
  }

  const validPositions = hierarchy[canonicalTeam] || [];
  const normalizedInputPosition = position.trim().toLowerCase();

  const canonicalPosition = validPositions.find(
    (pos) => pos.toLowerCase() === normalizedInputPosition ||
      pos.toLowerCase().replace(/_/g, ' ') === normalizedInputPosition.replace(/_/g, ' ')
  );

  if (!canonicalPosition) {
    throw new ValidationError(
      `Invalid position '${position}' for team '${canonicalTeam}'. Valid positions for '${canonicalTeam}' are: ${validPositions.join(', ')}.`
    );
  }

  return { canonicalTeam, canonicalPosition };
}

/**
 * Dynamically derives roles array for a member based on team and position
 */
export function getRolesByTeamAndPosition(team, position) {
  const { canonicalTeam, canonicalPosition } = validateTeamAndPosition(team, position);
  const normalizedTeam = canonicalTeam.toLowerCase();

  const roles = [];
  const primaryRole = TEAM_ROLE_MAP[normalizedTeam];
  if (primaryRole && !roles.includes(primaryRole)) {
    roles.push(primaryRole);
  }

  // Position specific role grants
  const normalizedPos = canonicalPosition.toLowerCase();
  if (normalizedPos === 'administrator' || normalizedPos === 'admin') {
    if (!roles.includes(ROLES.ADMIN)) {
      roles.push(ROLES.ADMIN);
    }
  }

  return roles;
}

/**
 * Checks if team is designated for internal use only
 */
export function isInternalTeam(team) {
  if (!team || typeof team !== 'string') return false;
  return INTERNAL_TEAMS.includes(team.trim().toLowerCase());
}
