const { Op, Transaction } = require('sequelize');

const { FuelTransaction, Maintenance } = require('../models');
const { ASSET_TYPES } = require('./asset.service');
const { recordUpdate } = require('./audit.service');

const AUDIT_ENTITY_FOR_ASSET = Object.freeze({ VEHICLE: 'Vehicle', MACHINERY: 'Machinery' });

const toNumber = (value) => (value == null ? null : Number(value));

function meterFields(assetType, asset) {
  if (assetType === ASSET_TYPES.MACHINERY || asset.isHoursBased) {
    return { meterType: 'HOURS', unit: 'Hours', current: 'currentHours', interval: 'serviceIntervalHours', next: 'nextServiceHours' };
  }
  return { meterType: 'KM', unit: 'KM', current: 'currentKM', interval: 'serviceIntervalKM', next: 'nextServiceKM' };
}

function lockAsset(asset, transaction) {
  return asset.constructor.findOne({ where: { id: asset.id }, lock: Transaction.LOCK.UPDATE, transaction });
}

async function highestOtherReading({ tenantId, assetType, assetId, meterType, excludeFuelId, transaction }) {
  const [fuelMax, serviceMax] = await Promise.all([
    FuelTransaction.max('meterReading', {
      where: { tenantId, assetType, assetId, meterType, status: 'active', id: { [Op.ne]: excludeFuelId } },
      transaction,
    }),
    Maintenance.max('meterReading', {
      where: { tenantId, assetType, assetId, meterType, type: 'preventive', stage: 'resolved', status: 'active' },
      transaction,
    }),
  ]);
  const readings = [fuelMax, serviceMax].map(toNumber).filter((value) => value != null);
  return readings.length ? Math.max(...readings) : null;
}

async function settleMeterFromFuel({
  tenantId,
  assetType,
  assetId,
  asset,
  meterType,
  fuelId,
  previous = null,
  nextReading = null,
  actingUserId,
  transaction,
}) {
  const unchanged = previous?.assetMeterBefore == null ? null : toNumber(previous.assetMeterBefore);
  const fields = meterFields(assetType, asset);
  if (fields.meterType !== meterType) return unchanged;

  const current = toNumber(asset[fields.current]);
  let base = current;

  const setByThisEntry =
    previous && previous.assetMeterBefore != null && current != null && current === toNumber(previous.meterReading);
  if (setByThisEntry) {
    const other = await highestOtherReading({ tenantId, assetType, assetId, meterType, excludeFuelId: fuelId, transaction });
    base = Math.min(current, Math.max(toNumber(previous.assetMeterBefore), other ?? -Infinity));
  }

  const raises = nextReading != null && (base == null || nextReading > base);
  const final = raises ? nextReading : base;

  if (final !== current) {
    const before = asset.toJSON();
    await asset.update({ [fields.current]: final, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: AUDIT_ENTITY_FOR_ASSET[assetType], entityId: asset.id, performedBy: actingUserId, before, after: asset },
      { transaction }
    );
  }

  if (raises) return base ?? 0;
  return setByThisEntry ? null : unchanged;
}

module.exports = { AUDIT_ENTITY_FOR_ASSET, meterFields, lockAsset, settleMeterFromFuel };
