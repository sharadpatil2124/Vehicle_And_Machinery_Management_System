const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const env = require('../config/env');
const { MAX_FILE_SIZE_BYTES } = require('./upload');

function translateDatabaseError(error) {
  if (error.name === 'SequelizeDatabaseError' && error.original?.sqlState === '45000') {
    return AppError.conflict(error.original.sqlMessage ?? 'That value is already in use');
  }

  switch (error.name) {
    case 'SequelizeUniqueConstraintError':
      return AppError.conflict('That value is already in use');
    case 'SequelizeForeignKeyConstraintError':
      return AppError.badRequest('Referenced record does not exist');
    case 'SequelizeValidationError':
      return AppError.badRequest(error.errors?.[0]?.message ?? 'Validation failed');
    default:
      return null;
  }
}

function translateUploadError(error) {
  if (error.name !== 'MulterError') return null;
  if (error.code === 'LIMIT_FILE_SIZE') {
    const maxMB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return AppError.badRequest(`File is too large — the limit is ${maxMB}MB`);
  }
  return AppError.badRequest('File upload failed');
}

function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }

  const known =
    error instanceof AppError ? error : (translateDatabaseError(error) ?? translateUploadError(error));

  if (known) {
    return res.status(known.statusCode).json({ error: known.message });
  }

  logger.error('Unhandled error', {
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    stack: error.stack,
  });

  return res.status(500).json({
    error: env.isProduction ? 'Internal server error' : `Internal server error: ${error.message}`,
  });
}

module.exports = { notFoundHandler, errorHandler };
