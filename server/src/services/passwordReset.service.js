const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const env = require('../config/env');
const { sequelize, User, Tenant, PasswordResetToken } = require('../models');
const AppError = require('../utils/AppError');
const { requirePassword } = require('../utils/validation');
const { recordAudit } = require('./audit.service');
const emailService = require('./email.service');

const TOKEN_BYTES = 32;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function issueResetToken(user, { transaction } = {}) {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);

  await PasswordResetToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null }, transaction }
  );

  await PasswordResetToken.create(
    { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
    { transaction }
  );

  return `${env.clientUrl}/reset-password?token=${rawToken}`;
}

async function requestPasswordReset({ email }) {
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanEmail) throw AppError.badRequest('Email is required');

  const user = await User.findOne({
    where: { email: cleanEmail },
    include: [{ model: Tenant, as: 'tenant' }],
  });

  if (user?.isActive && user.tenant?.isActive) {
    const resetUrl = await issueResetToken(user);
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: env.passwordResetTtlMinutes,
    });
  }
}

async function resetPassword({ token, password }) {
  const rawToken = typeof token === 'string' ? token.trim() : '';
  if (!rawToken) throw AppError.badRequest('Reset token is required');

  const newPassword = requirePassword(password);

  const record = await PasswordResetToken.findOne({
    where: { tokenHash: hashToken(rawToken) },
    include: [{ model: User, as: 'user', include: [{ model: Tenant, as: 'tenant' }] }],
  });

  if (!record || !record.isUsable || !record.user) {
    throw AppError.badRequest('This link is invalid or has expired. Request a new one.');
  }

  const { user } = record;
  if (!user.isActive || !user.tenant?.isActive) {
    throw AppError.badRequest('This link is invalid or has expired. Request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);

  await sequelize.transaction(async (transaction) => {
    await user.update({ passwordHash }, { transaction });

    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, usedAt: null }, transaction }
    );

    await recordAudit(
      {
        tenantId: user.tenantId,
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_RESET',
        performedBy: user.id,
      },
      { transaction }
    );
  });
}

async function isResetTokenValid(token) {
  const rawToken = typeof token === 'string' ? token.trim() : '';
  if (!rawToken) return false;

  const record = await PasswordResetToken.findOne({
    where: { tokenHash: hashToken(rawToken), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });

  return Boolean(record);
}

module.exports = { issueResetToken, requestPasswordReset, resetPassword, isResetTokenValid };
