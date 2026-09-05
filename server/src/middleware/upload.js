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

const singleDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});

const assetCreationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: AssetDocument.DOC_TYPES.length },
  fileFilter,
});

module.exports = {
  uploadSingleDocument: singleDocumentUpload.single('file'),
  uploadAssetCreationDocuments: assetCreationUpload.fields(
    AssetDocument.DOC_TYPES.map((docType) => ({ name: docType, maxCount: 1 }))
  ),
  MAX_FILE_SIZE_BYTES,
};
