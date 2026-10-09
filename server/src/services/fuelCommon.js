const { Site } = require('../models');
const AppError = require('../utils/AppError');
const { requireNumber } = require('../utils/validation');

const STORABLE_FUEL_TYPES = ['Diesel', 'Petrol'];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(value, places) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const roundQuantity = (value) => round(value, 3);
const roundMoney = (value) => round(value, 2);
const roundUnitCost = (value) => round(value, 4);

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateOnly() {
  return toDateOnly(new Date());
}

function isValidDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value) && !Number.isNaN(new Date(value).getTime());
}

function requireBusinessDate(value, label) {
  if (!isValidDateOnly(value)) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  const latestAllowed = toDateOnly(new Date(Date.now() + MS_PER_DAY));
  if (value > latestAllowed) {
    throw AppError.badRequest(`${label} cannot be in the future`);
  }
  return value;
}

function optionalDateFilter(value, label) {
  if (value === undefined || value === '') return undefined;
  if (!isValidDateOnly(value)) throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  return value;
}

function requirePositive(value, label) {
  const number = requireNumber(value, label);
  if (number <= 0) throw AppError.badRequest(`${label} must be greater than 0`);
  return number;
}

function requireStorableFuelType(value) {
  if (!STORABLE_FUEL_TYPES.includes(value)) {
    throw AppError.badRequest(`Fuel type must be one of: ${STORABLE_FUEL_TYPES.join(', ')}`);
  }
  return value;
}

async function siteNamesById(tenantId, siteIds) {
  const ids = [...new Set(siteIds.filter((id) => id != null))];
  if (ids.length === 0) return new Map();
  const sites = await Site.findAll({ where: { tenantId, id: ids }, attributes: ['id', 'name'] });
  return new Map(sites.map((site) => [site.id, site.name]));
}

module.exports = {
  STORABLE_FUEL_TYPES,
  roundQuantity,
  roundMoney,
  roundUnitCost,
  todayDateOnly,
  requireBusinessDate,
  optionalDateFilter,
  requirePositive,
  requireStorableFuelType,
  siteNamesById,
};
