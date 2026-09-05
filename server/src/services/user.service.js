const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const env = require('../config/env');
const { ROLES } = require('../config/permissions');
const { sequelize, User, Tenant } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, requireEmail } = require('../utils/validation');
const { recordAudit } = require('./audit.service');
const { issueResetToken } = require('./passwordReset.service');
const emailService = require('./email.service');

async function listOrganizationUsers({ tenantId }) {
  const users = await User.findAll({
    where: { tenantId },
    order: [['role', 'ASC']],
  });

  return users.map((user) => user.toPublicJSON());
}

function findSupervisor(tenantId, options = {}) {
  return User.findOne({ where: { tenantId, role: ROLES.SUPERVISOR }, ...options });
}

async function createSupervisor({ tenantId, actingUserId, name, email }) {
  const cleanName = requireText(name, 'Name', { max: 150 });
  const cleanEmail = requireEmail(email);

  if (await findSupervisor(tenantId)) {
    throw AppError.conflict('This organization already has a supervisor');
  }

  if (await User.findOne({ where: { email: cleanEmail } })) {
    throw AppError.conflict('An account with this email already exists');
  }

  const tenant = await Tenant.findByPk(tenantId);
  const unusablePassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(unusablePassword, env.bcryptSaltRounds);

  const { supervisor, resetUrl } = await sequelize.transaction(async (transaction) => {
    const created = await User.create(
      {
        tenantId,
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: ROLES.SUPERVISOR,
        status: 'active',
      },
      { transaction }
    );

    const url = await issueResetToken(created, { transaction });

    await recordAudit(
      {
        tenantId,
        entityType: 'User',
        entityId: created.id,
        action: 'SUPERVISOR_CREATED',
        after: { name: cleanName, email: cleanEmail, role: ROLES.SUPERVISOR },
        performedBy: actingUserId,
      },
      { transaction }
    );

    return { supervisor: created, resetUrl: url };
  });

  await emailService.sendSupervisorInviteEmail({
    to: cleanEmail,
    name: cleanName,
    organizationName: tenant?.organizationName ?? 'your organization',
    resetUrl,
    expiresInMinutes: env.passwordResetTtlMinutes,
  });

  const safeSupervisor = await User.findByPk(supervisor.id);
  return safeSupervisor.toPublicJSON();
}

async function updateSupervisor({ tenantId, actingUserId, name, email }) {
  const cleanName = requireText(name, 'Name', { max: 150 });
  const cleanEmail = requireEmail(email);

  const supervisor = await findSupervisor(tenantId);
  if (!supervisor) {
    throw AppError.notFound('This organization does not have a supervisor yet');
  }

  if (cleanEmail !== supervisor.email) {
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) throw AppError.conflict('An account with this email already exists');
  }

  const before = { name: supervisor.name, email: supervisor.email };
  const emailChanged = cleanEmail !== supervisor.email;

  const tenant = await Tenant.findByPk(tenantId);

  const resetUrl = await sequelize.transaction(async (transaction) => {
    await supervisor.update({ name: cleanName, email: cleanEmail }, { transaction });

    const url = emailChanged ? await issueResetToken(supervisor, { transaction }) : null;

    await recordAudit(
      {
        tenantId,
        entityType: 'User',
        entityId: supervisor.id,
        action: 'SUPERVISOR_UPDATED',
        before,
        after: { name: cleanName, email: cleanEmail },
        performedBy: actingUserId,
      },
      { transaction }
    );

    return url;
  });

  if (resetUrl) {
    await emailService.sendSupervisorInviteEmail({
      to: cleanEmail,
      name: cleanName,
      organizationName: tenant?.organizationName ?? 'your organization',
      resetUrl,
      expiresInMinutes: env.passwordResetTtlMinutes,
    });
  }

  const safeSupervisor = await User.findByPk(supervisor.id);
  return safeSupervisor.toPublicJSON();
}

async function setSupervisorStatus({ tenantId, actingUserId, status }) {
  if (!User.STATUSES.includes(status)) {
    throw AppError.badRequest(`Status must be one of: ${User.STATUSES.join(', ')}`);
  }

  const supervisor = await findSupervisor(tenantId);
  if (!supervisor) {
    throw AppError.notFound('This organization does not have a supervisor yet');
  }

  if (supervisor.status === status) {
    return supervisor.toPublicJSON();
  }

  const before = { status: supervisor.status };

  await sequelize.transaction(async (transaction) => {
    await supervisor.update({ status }, { transaction });

    await recordAudit(
      {
        tenantId,
        entityType: 'User',
        entityId: supervisor.id,
        action: status === 'active' ? 'SUPERVISOR_REACTIVATED' : 'SUPERVISOR_DEACTIVATED',
        before,
        after: { status },
        performedBy: actingUserId,
      },
      { transaction }
    );
  });

  return supervisor.toPublicJSON();
}

module.exports = {
  listOrganizationUsers,
  createSupervisor,
  updateSupervisor,
  setSupervisorStatus,
};
