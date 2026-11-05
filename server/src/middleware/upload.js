const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { AssetDocument } = require('../models');

const MAX_FILE_SIZE_BYTES = env.upload.maxFileSizeMB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function fileFilter(_req, file, callback) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return callback(AppError.badRequest('Only PDF, JPG and PNG files are accepted'));
  }
  callback(null, true);
}

// Browsers send file names as UTF-8; multer would otherwise read them as Latin-1.
const singleDocumentUpload = multer({
  defParamCharset: 'utf8',
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});

const assetCreationUpload = multer({
  defParamCharset: 'utf8',
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: AssetDocument.DOC_TYPES.length },
  fileFilter,
});

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

const LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const logoUpload = multer({
  defParamCharset: 'utf8',
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_SIZE_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    if (!LOGO_MIME_TYPES.has(file.mimetype)) {
      return callback(AppError.badRequest('Logo must be a PNG, JPG or WEBP image'));
    }
    callback(null, true);
  },
});

module.exports = {
  uploadSingleDocument: singleDocumentUpload.single('file'),
  uploadLogo: logoUpload.single('logo'),
  MAX_LOGO_SIZE_BYTES,
  uploadAssetCreationDocuments: assetCreationUpload.fields(
    AssetDocument.DOC_TYPES.map((docType) => ({ name: docType, maxCount: 1 }))
  ),
  MAX_FILE_SIZE_BYTES,
};
