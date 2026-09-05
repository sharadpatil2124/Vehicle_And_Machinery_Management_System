const AppError = require('./AppError');

function assertMeterNotDecreasing(current, incoming, unit) {
  const incomingValue = Number(incoming);

  if (!Number.isFinite(incomingValue)) {
    throw AppError.badRequest(`${unit} reading must be a number`);
  }

  const currentValue = Number(current);
  if (incomingValue < currentValue) {
    throw AppError.badRequest(
      `${unit} reading cannot be lower than the current reading (${currentValue})`
    );
  }

  return incomingValue;
}

module.exports = { assertMeterNotDecreasing };
