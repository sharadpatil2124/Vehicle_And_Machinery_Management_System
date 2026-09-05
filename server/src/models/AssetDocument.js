const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const DOC_TYPES = ['RC', 'PUC', 'NATIONAL_PERMIT', 'INSURANCE'];
const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];

class AssetDocument extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      assetType: this.assetType,
      assetId: this.assetId,
      docType: this.docType,
      originalFilename: this.originalFilename,
      mimeType: this.mimeType,
      fileSize: this.fileSize,
      uploadedBy: this.uploadedBy,
      uploadedByName: this.uploader ? this.uploader.name : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

AssetDocument.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
    },
    assetType: {
      type: DataTypes.ENUM(...ASSET_TYPES),
      allowNull: false,
    },
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    docType: {
      type: DataTypes.ENUM(...DOC_TYPES),
      allowNull: false,
    },
    originalFilename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    storedFilename: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    uploadedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'AssetDocument',
    tableName: 'asset_documents',
  }
);

AssetDocument.DOC_TYPES = DOC_TYPES;
AssetDocument.ASSET_TYPES = ASSET_TYPES;

module.exports = AssetDocument;
