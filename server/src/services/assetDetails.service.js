const { Vehicle, Machinery } = require('../models');
const { ASSET_TYPES } = require('./asset.service');
const { supervisorSiteId } = require('./siteAccess');

function assetKey(assetType, assetId) {
  return `${assetType}:${assetId}`;
}

// What identifies the asset is always shown. Where it is now and its current reading follow the site rules:
// a supervisor sees those only while the asset is at their own site.
function toAssetDetails(assetType, asset, auth) {
  const details = {
    assetType,
    assetId: asset.assetId,
    type: asset.type,
    modelNumber: asset.modelNumber,
    year: asset.year,
    fuelType: asset.fuelType,
    status: asset.status,
  };

  if (assetType === ASSET_TYPES.VEHICLE) {
    details.label = asset.registrationNumber;
    details.registrationNumber = asset.registrationNumber;
    details.chassisNumber = asset.chassisNumber;
    details.isHoursBased = asset.isHoursBased;
  } else {
    details.label = Machinery.label(asset);
    details.rcpl = asset.rcpl;
    details.name = asset.name;
    details.serialNumber = asset.serialNumber;
  }

  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId === null || Number(asset.currentSiteId) === Number(ownSiteId)) {
    details.id = asset.id;
    details.currentSiteId = asset.currentSiteId;
    details.currentHours = asset.currentHours == null ? null : Number(asset.currentHours);
    if (assetType === ASSET_TYPES.VEHICLE) {
      details.currentKM = asset.currentKM == null ? null : Number(asset.currentKM);
    }
  }

  return details;
}

// refs: anything with assetType and assetId. Returns details by assetKey.
async function loadAssetDetails(tenantId, refs, auth) {
  const idsOf = (assetType) => [...new Set(refs.filter((r) => r.assetType === assetType).map((r) => r.assetId))];
  const vehicleIds = idsOf(ASSET_TYPES.VEHICLE);
  const machineIds = idsOf(ASSET_TYPES.MACHINERY);

  const [vehicles, machines] = await Promise.all([
    vehicleIds.length ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds } }) : [],
    machineIds.length ? Machinery.findAll({ where: { tenantId, assetId: machineIds } }) : [],
  ]);

  const details = new Map();
  for (const vehicle of vehicles) {
    details.set(assetKey(ASSET_TYPES.VEHICLE, vehicle.assetId), toAssetDetails(ASSET_TYPES.VEHICLE, vehicle, auth));
  }
  for (const machine of machines) {
    details.set(assetKey(ASSET_TYPES.MACHINERY, machine.assetId), toAssetDetails(ASSET_TYPES.MACHINERY, machine, auth));
  }
  return details;
}

module.exports = { assetKey, loadAssetDetails };
