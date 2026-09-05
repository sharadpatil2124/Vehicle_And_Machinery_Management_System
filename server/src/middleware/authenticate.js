const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { User, Tenant } = require('../models');

async function authenticate(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized());
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(AppError.unauthorized('Invalid or expired token'));
  }

  const user = await User.findByPk(userId, {
    include: [{ model: Tenant, as: 'tenant' }],
  });

  if (!user || !user.isActive) {
    return next(AppError.unauthorized('Account is no longer active'));
  }

  if (!user.tenant || !user.tenant.isActive) {
    return next(AppError.unauthorized('Organization is no longer active'));
  }

  req.auth = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    name: user.name,
    organizationName: user.tenant.organizationName,
  };

  return next();
}

module.exports = authenticate;
