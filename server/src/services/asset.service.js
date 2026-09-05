const AppError = require('../utils/AppError');

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

async function resolveAsset(tenantId, assetType, assetId, { transaction } = {}) {
  const model = registry.get(assetType);
  if (!model) {
    throw AppError.badRequest(`Unknown asset type "${assetType}"`);
  }

  const asset = await model.findOne({ where: { assetId, tenantId }, transaction });
  if (!asset) {
    throw AppError.notFound('Asset not found');
  }

  return asset;
}

module.exports = { ASSET_TYPES, registerAssetModel, resolveAsset };
