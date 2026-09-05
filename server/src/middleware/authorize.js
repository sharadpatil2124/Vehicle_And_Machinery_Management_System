const AppError = require('../utils/AppError');
const { ROLES, hasPermission } = require('../config/permissions');
const authenticate = require('./authenticate');

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!allowedRoles.includes(req.auth.role)) return next(AppError.forbidden());
    return next();
  };
}

function requirePermission(resource, action) {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!hasPermission(req.auth.role, resource, action)) return next(AppError.forbidden());
    return next();
  };
}

const authenticated = [authenticate];

const adminOnly = [authenticate, requireRole(ROLES.ADMIN)];

module.exports = { requireRole, requirePermission, authenticated, adminOnly };
