const { Tenant } = require('../models');
const AppError = require('../utils/AppError');
const { optionalText } = require('../utils/validation');
const { recordAudit } = require('./audit.service');
const storage = require('./storage.service');
const logger = require('../utils/logger');

const ENTITY_TYPE = 'TENANT_BRANDING';

const IMAGE_SIGNATURES = [
  { mimeType: 'image/png', extension: '.png', matches: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mimeType: 'image/jpeg', extension: '.jpg', matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mimeType: 'image/webp', extension: '.webp', matches: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

function detectImage(buffer) {
  return IMAGE_SIGNATURES.find((signature) => signature.matches(buffer)) ?? null;
}

function toBranding(tenant) {
  return {
    organizationName: tenant.organizationName,
    dashboardTitle: tenant.dashboardTitle ?? null,
    hasLogo: Boolean(tenant.logoStoredFilename),
    logoVersion: tenant.logoUpdatedAt ? new Date(tenant.logoUpdatedAt).getTime() : null,
  };
}

async function findTenant(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw AppError.notFound('Organization not found');
  return tenant;
}

async function removeStoredFile(key) {
  if (!key) return;
  try {
    await storage.deleteFile(key);
  } catch (error) {
    logger.warn('Could not delete previous logo file', { key, error: error.message });
  }
}

async function getBranding({ tenantId }) {
  return toBranding(await findTenant(tenantId));
}

async function updateTitle({ tenantId, actingUserId, dashboardTitle }) {
  const tenant = await findTenant(tenantId);
  const before = tenant.dashboardTitle ?? null;
  const after = optionalText(typeof dashboardTitle === 'string' ? dashboardTitle.trim() : null, 'Dashboard title', { max: 150 });

  if (before !== after) {
    await tenant.update({ dashboardTitle: after });
    await recordAudit({
      tenantId,
      entityType: ENTITY_TYPE,
      entityId: tenantId,
      action: 'UPDATED',
      before: { dashboardTitle: before },
      after: { dashboardTitle: after },
      performedBy: actingUserId,
    });
  }

  return toBranding(tenant);
}

async function uploadLogo({ tenantId, actingUserId, file }) {
  if (!file?.buffer?.length) throw AppError.badRequest('Choose an image to upload');

  const image = detectImage(file.buffer);
  if (!image) throw AppError.badRequest('Logo must be a valid PNG, JPG or WEBP image');

  const tenant = await findTenant(tenantId);
  const previousKey = tenant.logoStoredFilename;
  const key = storage.buildBrandingKey(tenantId, image.extension);

  await storage.saveFile(key, file.buffer);
  try {
    await tenant.update({ logoStoredFilename: key, logoMimeType: image.mimeType, logoUpdatedAt: new Date() });
  } catch (error) {
    await removeStoredFile(key);
    throw error;
  }

  await removeStoredFile(previousKey);
  await recordAudit({
    tenantId,
    entityType: ENTITY_TYPE,
    entityId: tenantId,
    action: previousKey ? 'LOGO_REPLACED' : 'LOGO_UPLOADED',
    after: { mimeType: image.mimeType, size: file.buffer.length },
    performedBy: actingUserId,
  });

  return toBranding(tenant);
}

async function removeLogo({ tenantId, actingUserId }) {
  const tenant = await findTenant(tenantId);
  const previousKey = tenant.logoStoredFilename;
  if (!previousKey) return toBranding(tenant);

  await tenant.update({ logoStoredFilename: null, logoMimeType: null, logoUpdatedAt: new Date() });
  await removeStoredFile(previousKey);
  await recordAudit({
    tenantId,
    entityType: ENTITY_TYPE,
    entityId: tenantId,
    action: 'LOGO_REMOVED',
    performedBy: actingUserId,
  });

  return toBranding(tenant);
}

async function getLogoForDownload({ tenantId }) {
  const tenant = await findTenant(tenantId);
  if (!tenant.logoStoredFilename) throw AppError.notFound('No logo has been uploaded');
  return { key: tenant.logoStoredFilename, mimeType: tenant.logoMimeType };
}

module.exports = { getBranding, updateTitle, uploadLogo, removeLogo, getLogoForDownload };
