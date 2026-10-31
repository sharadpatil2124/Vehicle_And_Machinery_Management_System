const AppError = require('../utils/AppError');

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function validateIdParam(notFoundMessage) {
  return (req, _res, next, value) => {
    if (POSITIVE_INTEGER.test(value)) return next();
    const message = typeof notFoundMessage === 'function' ? notFoundMessage(req) : notFoundMessage;
    return next(AppError.notFound(message));
  };
}

module.exports = { validateIdParam };
