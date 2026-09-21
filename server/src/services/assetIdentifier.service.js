const { Op } = require('sequelize');
const { Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Chassis Number and Registration Number must be unique system-wide, across
 * every tenant and across both Vehicles and Machinery combined (client's
 * explicit request) — the one deliberate exception to this app's usual rule
 * that every query is scoped by tenantId. Do not add a tenantId filter to
 * these lookups; that would silently turn this back into per-tenant
 * uniqueness, which is not what was asked for.
 *
 * "Chassis Number" is `vehicles.chassisNumber` on a vehicle, but
 * `machinery.serialNumber` on a machine — the machinery field is only
 * labelled "Chassis Number" in the UI (see MachineryFormPage), the column
 * itself was never renamed. Both are checked here under that one shared
 * identifier.
 *
 * This is the primary, immediate check — it runs before either table is
 * written to, so a duplicate is rejected with a clear message before any
 * insert is attempted. Migration `0016` also adds a same-value trigger on
 * both tables as a database-level backstop, for a raw SQL write that skips
 * the application entirely, or a race between two concurrent requests.
 */

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
