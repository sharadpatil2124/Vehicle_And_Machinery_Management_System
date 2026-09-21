const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const env = require('../config/env');
const { ROLES } = require('../config/permissions');
const { sequelize, User, Tenant, Site } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, requireEmail } = require('../utils/validation');
const { recordAudit } = require('./audit.service');
const { issueResetToken } = require('./passwordReset.service');
const emailService = require('./email.service');

async function listOrganizationUsers({ tenantId }) {
  const users = await User.findAll({
    where: { tenantId },
    order: [['role', 'ASC'], ['createdAt', 'ASC']],
  });

  return users.map((user) => user.toPublicJSON());
}

async function findSupervisorById(tenantId, id) {
  return User.findOne({ where: { id, tenantId, role: ROLES.SUPERVISOR } });
}

/**
 * Checks the site the Admin picked for a Supervisor: it has to exist, belong to
 * the same organization, and still be active. Returns the site's id.
 */
async function requireAssignableSiteId(tenantId, siteId, { transaction } = {}) {
  if (siteId === undefined || siteId === null || siteId === '') {
    throw AppError.badRequest('Select the site this supervisor will work at');
  }

  const site = await Site.findOne({ where: { id: siteId, tenantId }, transaction });
  if (!site) throw AppError.badRequest('Site not found');
  if (site.status !== 'active') {
    throw AppError.badRequest('That site is archived — pick an active site');
  }

  return site.id;
}

/**
 * The actual row-creation work, reused by both `createSupervisor` (adding one
 * supervisor after the organization already exists) and `auth.service.js#signUp`
 * (adding several while the organization is being created) — same account
 * shape either way: an unusable random password, replaced via a one-time
 * emailed link, so a real password never passes through the Admin or email.
 * Takes the caller's own transaction so a batch of supervisors created at
 * signup succeeds or fails together with the organization itself.
 */
async function createSupervisorRecord({ tenantId, actingUserId, name, email, siteId, transaction }) {
  const cleanName = requireText(name, 'Name', { max: 150 });
  const cleanEmail = requireEmail(email);
  // A Supervisor works at exactly one site. `siteId` is optional here only
  // because sign-up creates supervisors before any site exists; the Admin then
  // assigns each of them a site from the Organization Users page.
  const cleanSiteId =
    siteId === undefined || siteId === null || siteId === ''
      ? null
      : await requireAssignableSiteId(tenantId, siteId, { transaction });

  if (await User.findOne({ where: { email: cleanEmail }, transaction })) {
    throw AppError.conflict(`An account with this email already exists: ${cleanEmail}`);
  }

  const unusablePassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(unusablePassword, env.bcryptSaltRounds);

  const created = await User.create(
    {
      tenantId,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: ROLES.SUPERVISOR,
      status: 'active',
      siteId: cleanSiteId,
    },
    { transaction }
  );

  const resetUrl = await issueResetToken(created, { transaction });

  await recordAudit(
    {
      tenantId,
      entityType: 'User',
      entityId: created.id,
      action: 'SUPERVISOR_CREATED',
      after: { name: cleanName, email: cleanEmail, role: ROLES.SUPERVISOR, siteId: cleanSiteId },
      performedBy: actingUserId,
    },
    { transaction }
  );

  return { supervisor: created, resetUrl, name: cleanName, email: cleanEmail };
}

/**
 * A single supervisor, added to an organization that already exists. The Admin
 * must pick the one site this supervisor will be able to work with — every
 * other site's data stays invisible to them.
 */
async function createSupervisor({ tenantId, actingUserId, name, email, siteId }) {
  const tenant = await Tenant.findByPk(tenantId);
  await requireAssignableSiteId(tenantId, siteId);

  const { supervisor, resetUrl, name: cleanName, email: cleanEmail } = await sequelize.transaction(
    (transaction) => createSupervisorRecord({ tenantId, actingUserId, name, email, siteId, transaction })
  );

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

/**
 * Only an Admin reaches this. A Supervisor can never edit their own account, so
 * this is also the only way the assigned site can ever change.
 */
async function updateSupervisor({ tenantId, actingUserId, supervisorId, name, email, siteId }) {
  const cleanName = requireText(name, 'Name', { max: 150 });
  const cleanEmail = requireEmail(email);
  const cleanSiteId = await requireAssignableSiteId(tenantId, siteId);

  const supervisor = await findSupervisorById(tenantId, supervisorId);
  if (!supervisor) {
    throw AppError.notFound('Supervisor not found');
  }

  if (cleanEmail !== supervisor.email) {
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) throw AppError.conflict('An account with this email already exists');
  }

  const before = { name: supervisor.name, email: supervisor.email, siteId: supervisor.siteId };
  const emailChanged = cleanEmail !== supervisor.email;

  const tenant = await Tenant.findByPk(tenantId);

  const resetUrl = await sequelize.transaction(async (transaction) => {
    await supervisor.update(
      { name: cleanName, email: cleanEmail, siteId: cleanSiteId },
      { transaction }
    );

    const url = emailChanged ? await issueResetToken(supervisor, { transaction }) : null;

    await recordAudit(
      {
        tenantId,
        entityType: 'User',
        entityId: supervisor.id,
        action: 'SUPERVISOR_UPDATED',
        before,
        after: { name: cleanName, email: cleanEmail, siteId: cleanSiteId },
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

async function setSupervisorStatus({ tenantId, actingUserId, supervisorId, status }) {
  if (!User.STATUSES.includes(status)) {
    throw AppError.badRequest(`Status must be one of: ${User.STATUSES.join(', ')}`);
  }

  const supervisor = await findSupervisorById(tenantId, supervisorId);
  if (!supervisor) {
    throw AppError.notFound('Supervisor not found');
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
  createSupervisorRecord,
  createSupervisor,
  updateSupervisor,
  setSupervisorStatus,
};
