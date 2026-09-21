const AppError = require('../utils/AppError');
const { assertSiteAllowed } = require('./siteAccess');

const ASSET_TYPES = Object.freeze({
  VEHICLE: 'VEHICLE',
  MACHINERY: 'MACHINERY',
});

const registry = new Map();

function registerAssetModel(assetType, model) {
  if (!Object.values(ASSET_TYPES).includes(assetType)) {
    throw new Error(`asset.service: unknown asset type "${assetType}"`);
  }
  registry.set(assetType, model);
}

/**
 * Finds a Vehicle or a Machine by its business id (e.g. "VEH-000001").
 *
 * Documents, compliance records and site history all reach their asset through
 * this one function, so checking the Supervisor's site here protects all three
 * of those modules at once.
 */
async function resolveAsset(tenantId, assetType, assetId, { transaction, auth } = {}) {
  const model = registry.get(assetType);
  if (!model) {
    throw AppError.badRequest(`Unknown asset type "${assetType}"`);
  }

  const asset = await model.findOne({ where: { assetId, tenantId }, transaction });
  if (!asset) {
    throw AppError.notFound('Asset not found');
  }

  assertSiteAllowed(auth, asset.currentSiteId, 'Asset not found');

  return asset;
}

module.exports = { ASSET_TYPES, registerAssetModel, resolveAsset };
