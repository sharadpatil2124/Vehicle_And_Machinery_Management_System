const SPARE_AXLE = 0;

function position(code, label, axle, side, slot) {
  return Object.freeze({ code, label, axle, side, slot });
}

const LIGHT_VEHICLE_POSITIONS = Object.freeze([
  position('FL', 'Front left', 1, 'L', 'single'),
  position('FR', 'Front right', 1, 'R', 'single'),
  position('RL', 'Rear left', 2, 'L', 'single'),
  position('RR', 'Rear right', 2, 'R', 'single'),
  position('SP1', 'Spare', SPARE_AXLE, null, 'spare'),
]);

function dualAxle(axle) {
  return [
    position(`A${axle}LO`, `Axle ${axle} left outer`, axle, 'L', 'outer'),
    position(`A${axle}LI`, `Axle ${axle} left inner`, axle, 'L', 'inner'),
    position(`A${axle}RI`, `Axle ${axle} right inner`, axle, 'R', 'inner'),
    position(`A${axle}RO`, `Axle ${axle} right outer`, axle, 'R', 'outer'),
  ];
}

const HEAVY_VEHICLE_POSITIONS = Object.freeze([
  position('A1L', 'Axle 1 (front) left', 1, 'L', 'single'),
  position('A1R', 'Axle 1 (front) right', 1, 'R', 'single'),
  ...dualAxle(2),
  ...dualAxle(3),
  ...dualAxle(4),
  position('SP1', 'Spare 1', SPARE_AXLE, null, 'spare'),
  position('SP2', 'Spare 2', SPARE_AXLE, null, 'spare'),
]);

function positionsForVehicle(vehicle) {
  return vehicle.isHoursBased ? HEAVY_VEHICLE_POSITIONS : LIGHT_VEHICLE_POSITIONS;
}

function findPosition(vehicle, code) {
  return positionsForVehicle(vehicle).find((p) => p.code === code) ?? null;
}

const ALL_POSITION_LABELS = Object.freeze(
  Object.fromEntries(
    [...LIGHT_VEHICLE_POSITIONS, ...HEAVY_VEHICLE_POSITIONS].map((p) => [p.code, p.label])
  )
);

module.exports = { SPARE_AXLE, positionsForVehicle, findPosition, ALL_POSITION_LABELS };
