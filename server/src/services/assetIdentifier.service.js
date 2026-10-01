const { Op } = require('sequelize');
const { Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');

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

async function assertRegistrationNumberAvailable({ value, excludeVehicleId, excludeMachineId }) {
  if (!value) return;

  const [vehicleMatch, machineMatch] = await Promise.all([
    Vehicle.findOne({
      where: { registrationNumber: value, ...(excludeVehicleId ? { id: { [Op.ne]: excludeVehicleId } } : {}) },
    }),
    Machinery.findOne({
      where: { registrationNumber: value, ...(excludeMachineId ? { id: { [Op.ne]: excludeMachineId } } : {}) },
    }),
  ]);

  if (vehicleMatch || machineMatch) {
    throw AppError.conflict('This registration number is already in use by another asset');
  }
}

module.exports = { assertChassisNumberAvailable, assertRegistrationNumberAvailable };
