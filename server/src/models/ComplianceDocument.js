const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const DOC_TYPES = ['ROAD_TAX', 'NATIONAL_PERMIT', 'INSURANCE', 'STATE_PERMIT', 'PUC'];
const ROAD_TAX_TYPES = ['OTT', 'LTT', 'OTHER'];
const ASSET_TYPES = ['VEHICLE', 'MACHINERY'];
const EXPIRY_WARNING_DAYS = 15;

function daysBetween(from, to) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

class ComplianceDocument extends Model {
  get daysRemaining() {
    if (!this.expiryDate) return null;
    return daysBetween(new Date(), this.expiryDate);
  }

  get status() {
    const days = this.daysRemaining;
    if (days === null) return null;
    if (days < 0) return 'EXPIRED';
    if (days <= EXPIRY_WARNING_DAYS) return 'EXPIRING_SOON';
    return 'VALID';
  }

  toPublicJSON() {
    return {
      id: this.id,
      assetType: this.assetType,
      assetId: this.assetId,
      docType: this.docType,
      roadTaxType: this.roadTaxType,
      startDate: this.startDate,
      expiryDate: this.expiryDate,
      status: this.status,
      daysRemaining: this.daysRemaining,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

ComplianceDocument.init(
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
    roadTaxType: {
      type: DataTypes.ENUM(...ROAD_TAX_TYPES),
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    updatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'ComplianceDocument',
    tableName: 'compliance_documents',
  }
);

ComplianceDocument.DOC_TYPES = DOC_TYPES;
ComplianceDocument.ROAD_TAX_TYPES = ROAD_TAX_TYPES;
ComplianceDocument.ASSET_TYPES = ASSET_TYPES;
ComplianceDocument.EXPIRY_WARNING_DAYS = EXPIRY_WARNING_DAYS;

module.exports = ComplianceDocument;
