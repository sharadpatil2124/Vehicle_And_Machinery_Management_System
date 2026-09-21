const { sequelize, AssetDocument, User } = require('../models');
const AppError = require('../utils/AppError');
const { resolveAsset } = require('./asset.service');
const { recordCreate, recordUpdate } = require('./audit.service');
const storage = require('./storage.service');

const { DOC_TYPES } = AssetDocument;

function getMandatoryDocTypes(assetType) {
  return assetType === 'VEHICLE' ? ['RC', 'PUC'] : [];
}

function assertDocType(docType) {
  if (!DOC_TYPES.includes(docType)) {
    throw AppError.badRequest(`Document type must be one of: ${DOC_TYPES.join(', ')}`);
  }
}

function toPublic(doc) {
  return doc.toPublicJSON();
}

async function listDocuments({ tenantId, auth, assetType, assetId }) {
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const docs = await AssetDocument.findAll({
    where: { tenantId, assetType, assetId },
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
  });
  const byType = new Map(docs.map((doc) => [doc.docType, doc]));
  const mandatoryDocTypes = getMandatoryDocTypes(assetType);

  return DOC_TYPES.map((docType) => {
    const doc = byType.get(docType);
    return {
      docType,
      mandatory: mandatoryDocTypes.includes(docType),
      uploaded: Boolean(doc),
      document: doc ? toPublic(doc) : null,
    };
  });
}

async function uploadDocument({ tenantId, auth, assetType, assetId, docType, actingUserId, file }) {
  assertDocType(docType);
  if (!file) throw AppError.badRequest('A file is required');

  await resolveAsset(tenantId, assetType, assetId, { auth });

  const existing = await AssetDocument.findOne({ where: { tenantId, assetType, assetId, docType } });
  const key = storage.buildKey(tenantId, assetType, assetId, docType, file.originalname);
  await storage.saveFile(key, file.buffer);

  try {
    const saved = await sequelize.transaction(async (transaction) => {
      if (existing) {
        const before = existing.toJSON();
        const oldKey = existing.storedFilename;

        await existing.update(
          {
            originalFilename: file.originalname,
            storedFilename: key,
            mimeType: file.mimetype,
            fileSize: file.size,
            uploadedBy: actingUserId,
          },
          { transaction }
        );

        await recordUpdate(
          {
            tenantId,
            entityType: 'AssetDocument',
            entityId: existing.id,
            performedBy: actingUserId,
            before,
            after: existing,
          },
          { transaction }
        );

        transaction.afterCommit(() => {
          storage.deleteFile(oldKey).catch(() => {});
        });

        return existing;
      }

      const created = await AssetDocument.create(
        {
          tenantId,
          assetType,
          assetId,
          docType,
          originalFilename: file.originalname,
          storedFilename: key,
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: actingUserId,
        },
        { transaction }
      );

      await recordCreate(
        { tenantId, entityType: 'AssetDocument', entityId: created.id, performedBy: actingUserId, after: created },
        { transaction }
      );

      return created;
    });

    const withUploader = await AssetDocument.findByPk(saved.id, {
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
    });
    return toPublic(withUploader);
  } catch (error) {
    await storage.deleteFile(key).catch(() => {});
    throw error;
  }
}

async function getDocumentForDownload({ tenantId, auth, assetType, assetId, docType }) {
  assertDocType(docType);
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const doc = await AssetDocument.findOne({ where: { tenantId, assetType, assetId, docType } });
  if (!doc) throw AppError.notFound('Document not found');
  return doc;
}

async function createDocumentsForNewAsset({ tenantId, assetType, assetId, actingUserId, files, transaction }) {
  const savedKeys = [];

  for (const docType of DOC_TYPES) {
    const file = files?.[docType];
    if (!file) continue;

    const key = storage.buildKey(tenantId, assetType, assetId, docType, file.originalname);
    await storage.saveFile(key, file.buffer);
    savedKeys.push(key);

    const document = await AssetDocument.create(
      {
        tenantId,
        assetType,
        assetId,
        docType,
        originalFilename: file.originalname,
        storedFilename: key,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actingUserId,
      },
      { transaction }
    );

    await recordCreate(
      { tenantId, entityType: 'AssetDocument', entityId: document.id, performedBy: actingUserId, after: document },
      { transaction }
    );
  }

  return savedKeys;
}

module.exports = {
  getMandatoryDocTypes,
  listDocuments,
  uploadDocument,
  getDocumentForDownload,
  createDocumentsForNewAsset,
};
