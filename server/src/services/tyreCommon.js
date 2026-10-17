const { Transaction } = require('sequelize');

const { Site, TyreStock, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { supervisorSiteId } = require('./siteAccess');
const { roundMoney } = require('./fuelCommon');

function siteFilter(auth, query) {
  const own = supervisorSiteId(auth);
  if (own !== null) return own;
  return query.siteId ? Number(query.siteId) : null;
}

function meterTypeFor(assetType, asset) {
  if (assetType === 'MACHINERY') return 'HOURS';
  return asset.isHoursBased ? 'HOURS' : 'KM';
}

function readingOf(asset, meterType) {
  if (!asset) return null;
  const value = meterType === 'HOURS' ? asset.currentHours : asset.currentKM;
  return value == null ? null : Number(value);
}

function meterUnit(meterType) {
  return meterType === 'HOURS' ? 'hours' : 'KM';
}

function formatReading(value) {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function runOf(fitment, asset) {
  const end = fitment.removedAt != null ? Number(fitment.removeMeterReading) : readingOf(asset, fitment.meterType);
  if (end == null) return 0;
  return Math.max(0, roundMoney(end - Number(fitment.fitMeterReading)));
}

async function assertSiteUsable(tenantId, siteId) {
  const id = Number(siteId);
  if (!Number.isInteger(id) || id < 1) throw AppError.badRequest('Site is required');
  const site = await Site.findOne({ where: { tenantId, id } });
  if (!site) throw AppError.badRequest('Site not found');
  if (site.status !== 'active') throw AppError.badRequest('This site is archived and cannot be used');
  return id;
}

async function lockStock(tenantId, siteId, tyreTypeId, transaction) {
  const where = { tenantId, siteId, tyreTypeId };
  const existing = await TyreStock.findOne({ where, transaction, lock: Transaction.LOCK.UPDATE });
  if (existing) return existing;
  await TyreStock.findOrCreate({ where, defaults: { newQuantity: 0, usedQuantity: 0, stockValue: 0 }, transaction });
  return TyreStock.findOne({ where, transaction, lock: Transaction.LOCK.UPDATE });
}

async function assetsByKey(tenantId, rows) {
  const vehicleIds = [...new Set(rows.filter((r) => r.assetType === 'VEHICLE').map((r) => r.assetId))];
  const machineIds = [...new Set(rows.filter((r) => r.assetType === 'MACHINERY').map((r) => r.assetId))];
  const [vehicles, machines] = await Promise.all([
    vehicleIds.length ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds } }) : [],
    machineIds.length ? Machinery.findAll({ where: { tenantId, assetId: machineIds } }) : [],
  ]);
  const map = new Map();
  for (const v of vehicles) map.set(`VEHICLE:${v.assetId}`, v);
  for (const m of machines) map.set(`MACHINERY:${m.assetId}`, m);
  return map;
}

function assetSummary(assetType, assetId, asset) {
  if (!asset) return { assetType, assetId, assetLabel: assetId, assetRecordId: null, assetKind: assetType === 'VEHICLE' ? 'Vehicle' : 'Machinery', assetSiteId: null };
  const label =
    assetType === 'VEHICLE' ? asset.registrationNumber : Machinery.label(asset);
  return {
    assetType,
    assetId,
    assetLabel: label,
    assetRecordId: asset.id,
    assetKind: assetType === 'VEHICLE' ? asset.type : 'Machinery',
    assetSiteId: asset.currentSiteId ?? null,
  };
}

function tyreTypeSummary(tyreType) {
  if (!tyreType) return { tyreTypeLabel: null, tyreSize: null };
  return { tyreTypeLabel: tyreType.label, tyreSize: tyreType.size, tyreTypeCode: tyreType.typeCode };
}

module.exports = {
  siteFilter,
  meterTypeFor,
  readingOf,
  meterUnit,
  formatReading,
  runOf,
  assertSiteUsable,
  lockStock,
  assetsByKey,
  assetSummary,
  tyreTypeSummary,
};
