const { Op } = require('sequelize');
const { Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { containsPattern } = require('../utils/queryOptions');

async function assertChassisNumberAvailable({ value, excludeVehicleId, excludeMachineId }) {
  if (!value) return;

  const [vehicleMatch, machineMatch] = await Promise.all([
    Vehicle.findOne({
      where: { chassisNumber: value, ...(excludeVehicleId ? { id: { [Op.ne]: excludeVehicleId } } : {}) },
    }),
    Machinery.findOne({
      where: { serialNumber: value, ...(excludeMachineId ? { id: { [Op.ne]: excludeMachineId } } : {}) },
    }),
  ]);

  if (vehicleMatch || machineMatch) {
    throw AppError.conflict('This chassis number is already in use by another asset');
  }
}

async function assertRegistrationNumberAvailable({ value, excludeVehicleId }) {
  if (!value) return;

  const vehicleMatch = await Vehicle.findOne({
    where: { registrationNumber: value, ...(excludeVehicleId ? { id: { [Op.ne]: excludeVehicleId } } : {}) },
  });

  if (vehicleMatch) {
    throw AppError.conflict('This registration number is already in use by another asset');
  }
}

const RCPL_TAKEN_MESSAGE = 'This RCPL is already in use by another machine';

async function isRcplAvailable({ tenantId, value, excludeMachineId }) {
  const match = await Machinery.findOne({
    where: {
      tenantId,
      rcpl: Machinery.normalizeRcpl(value),
      ...(excludeMachineId ? { id: { [Op.ne]: excludeMachineId } } : {}),
    },
    attributes: ['id'],
  });
  return !match;
}

async function assertRcplAvailable({ tenantId, value, excludeMachineId }) {
  if (!(await isRcplAvailable({ tenantId, value, excludeMachineId }))) throw AppError.conflict(RCPL_TAKEN_MESSAGE);
}

function isRcplCollision(error) {
  return (
    error.name === 'SequelizeUniqueConstraintError' &&
    Object.keys(error.fields ?? {}).some((indexName) => indexName.includes('rcpl'))
  );
}

async function machineAssetIdsMatchingRcpl(tenantId, search) {
  const machines = await Machinery.findAll({
    where: { tenantId, rcpl: { [Op.like]: containsPattern(search) } },
    attributes: ['assetId'],
  });
  return machines.map((m) => m.assetId);
}

async function vehicleAssetIdsMatchingRegistration(tenantId, search) {
  const vehicles = await Vehicle.findAll({
    where: { tenantId, registrationNumber: { [Op.like]: containsPattern(search) } },
    attributes: ['assetId'],
  });
  return vehicles.map((v) => v.assetId);
}

module.exports = {
  assertChassisNumberAvailable,
  assertRegistrationNumberAvailable,
  isRcplAvailable,
  assertRcplAvailable,
  isRcplCollision,
  RCPL_TAKEN_MESSAGE,
  machineAssetIdsMatchingRcpl,
  vehicleAssetIdsMatchingRegistration,
};
