const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const AppError = require('../utils/AppError');

function createLimiter({ windowMs, max, devMax, message }) {
  return rateLimit({
    windowMs,
    limit: env.isProduction ? max : devMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, message)),
  });
}

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  devMax: 200,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

const signupLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  devMax: 100,
  message: 'Too many organizations created from this address. Please try again later.',
});

module.exports = { authLimiter, signupLimiter };
