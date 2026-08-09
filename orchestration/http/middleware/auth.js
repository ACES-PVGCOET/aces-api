import { IAMService } from '../../../iam/index.js';
import { UnauthorizedError, ForbiddenError } from '../../../shared/errors/index.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import { hasAuthority, getRolesForAuthority } from './authorityManager.js';

/**
 * Middleware enforcing JWT token authentication
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token missing. Please log in.');
  }

  const decoded = await IAMService.verifyToken(token);
  req.user = decoded; // { id, roles, email, team, position }
  next();
});

/**
 * Middleware enforcing Role-Based Access Control (RBAC) by role names
 * @param  {...string} requiredRoles - Roles required to access endpoint
 */
export const requireRoles = (...requiredRoles) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.roles) {
      return next(new UnauthorizedError('User authentication context missing.'));
    }

    const userRoles = req.user.roles;
    const hasPermission = requiredRoles.some((role) => userRoles.includes(role) || userRoles.includes('admin'));

    if (!hasPermission) {
      return next(new ForbiddenError(`Required role(s): [${requiredRoles.join(', ')}]. Access denied.`));
    }

    next();
  };
};

/**
 * Middleware enforcing authority-based RBAC based on authorities.json
 */
export const requireAuthority = (authorityInput) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.roles) {
      return next(new UnauthorizedError('User authentication context missing.'));
    }

    const userRoles = req.user.roles;
    const isAuthorized = hasAuthority(userRoles, authorityInput);

    if (!isAuthorized) {
      const allowedRoles = getRolesForAuthority(authorityInput);
      const authorityLabel =
        typeof authorityInput === 'string'
          ? authorityInput
          : `${authorityInput.resource}.${authorityInput.action}`;
      return next(
        new ForbiddenError(
          `Access denied for authority '${authorityLabel}'. Required role(s): [${allowedRoles.join(', ')}].`
        )
      );
    }

    next();
  };
};

/**
 * Fluent builder API for authority-based RBAC middleware
 */
export const authorize = (authorityInput) => requireAuthority(authorityInput);
authorize.can = (authorityInput) => requireAuthority(authorityInput);
authorize.resource = (resourceName) => ({
  action: (actionName) => requireAuthority({ resource: resourceName, action: actionName }),
});

/**
 * Optional authentication middleware that attaches user context if token is provided, but does not block unauthenticated requests.
 */
export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (token) {
    try {
      const decoded = await IAMService.verifyToken(token);
      req.user = decoded;
    } catch (_err) {
      // Ignore token errors for optional auth
    }
  }
  next();
});

