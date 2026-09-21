const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const { ROLES } = require('../config/permissions');
const { sequelize, Tenant, User } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, requireEmail, requirePassword } = require('../utils/validation');
const { recordAudit } = require('./audit.service');
const { createSupervisorRecord } = require('./user.service');
const emailService = require('./email.service');

const INVALID_CREDENTIALS = 'Invalid email or password';

const ABSENT_ACCOUNT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), env.bcryptSaltRounds);

function generateTenantId() {
  return `tenant_${crypto.randomBytes(12).toString('hex')}`;
}

function issueToken(user) {
  return jwt.sign({ sub: String(user.id) }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function buildSession(user, tenant) {
  return {
    token: issueToken(user),
    user: user.toPublicJSON(),
    organization: {
      tenantId: tenant.tenantId,
      organizationName: tenant.organizationName,
    },
  };
}

function readSupervisorEntries(supervisors) {
  if (!Array.isArray(supervisors)) return [];
  return supervisors
    .map((entry) => ({
      name: typeof entry?.name === 'string' ? entry.name.trim() : '',
      email: typeof entry?.email === 'string' ? entry.email.trim() : '',
    }))
    .filter((entry) => entry.name || entry.email);
}

async function signUp({ organizationName, name, email, password, supervisors }) {
  const cleanOrganizationName = requireText(organizationName, 'Organization name', { max: 150 });
  const cleanName = requireText(name, 'Name', { max: 150 });
  const cleanEmail = requireEmail(email);
  const cleanPassword = requirePassword(password);
  const supervisorEntries = readSupervisorEntries(supervisors);

  if (await User.findOne({ where: { email: cleanEmail } })) {
    throw AppError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(cleanPassword, env.bcryptSaltRounds);
  const tenantId = generateTenantId();

  const { tenant, user, createdSupervisors } = await sequelize.transaction(async (transaction) => {
    const createdTenant = await Tenant.create(
      {
        tenantId,
        organizationName: cleanOrganizationName,
        email: cleanEmail,
        status: 'active',
      },
      { transaction }
    );

    const createdUser = await User.create(
      {
        tenantId,
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: ROLES.ADMIN,
        status: 'active',
      },
      { transaction }
    );

    await recordAudit(
      {
        tenantId,
        entityType: 'Tenant',
        entityId: tenantId,
        action: 'ORGANIZATION_CREATED',
        after: { organizationName: cleanOrganizationName, adminEmail: cleanEmail },
        performedBy: createdUser.id,
      },
      { transaction }
    );

    const createdSupervisors = [];
    for (const entry of supervisorEntries) {
      const result = await createSupervisorRecord({
        tenantId,
        actingUserId: createdUser.id,
        name: entry.name,
        email: entry.email,
        transaction,
      });
      createdSupervisors.push(result);
    }

    return { tenant: createdTenant, user: createdUser, createdSupervisors };
  });

  for (const supervisor of createdSupervisors) {
    await emailService.sendSupervisorInviteEmail({
      to: supervisor.email,
      name: supervisor.name,
      organizationName: cleanOrganizationName,
      resetUrl: supervisor.resetUrl,
      expiresInMinutes: env.passwordResetTtlMinutes,
    });
  }

  const safeUser = await User.findByPk(user.id);
  return buildSession(safeUser, tenant);
}

async function logIn({ email, password }) {
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const suppliedPassword = typeof password === 'string' ? password : '';

  if (!cleanEmail || !suppliedPassword) {
    throw AppError.badRequest('Email and password are required');
  }

  const user = await User.scope('withPassword').findOne({
    where: { email: cleanEmail },
    include: [{ model: Tenant, as: 'tenant' }],
  });

  const passwordMatches = await bcrypt.compare(
    suppliedPassword,
    user?.passwordHash ?? ABSENT_ACCOUNT_HASH
  );

  if (!user || !passwordMatches) {
    throw AppError.unauthorized(INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw AppError.forbidden('This account has been deactivated');
  }

  if (!user.tenant?.isActive) {
    throw AppError.forbidden('This organization is not active');
  }

  await user.update({ lastLoginAt: new Date() });

  await recordAudit({
    tenantId: user.tenantId,
    entityType: 'User',
    entityId: user.id,
    action: 'LOGIN',
    performedBy: user.id,
  });

  const safeUser = await User.findByPk(user.id);
  return buildSession(safeUser, user.tenant);
}

async function logOut({ userId, tenantId }) {
  await recordAudit({
    tenantId,
    entityType: 'User',
    entityId: userId,
    action: 'LOGOUT',
    performedBy: userId,
  });
}

module.exports = { signUp, logIn, logOut };
