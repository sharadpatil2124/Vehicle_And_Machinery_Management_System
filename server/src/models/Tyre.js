const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const TYRE_STATUSES = ['active', 'archived'];
const TYRE_STATES = ['in_stock', 'fitted', 'scrapped'];
const TYRE_CONDITIONS = ['new', 'retreaded'];

class Tyre extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      tyreCode: this.tyreCode,
      serialNumber: this.serialNumber,
      brand: this.brand,
      modelName: this.modelName,
      size: this.size,
      tyreCondition: this.tyreCondition,
      purchaseDate: this.purchaseDate,
      purchaseCost: this.purchaseCost == null ? null : Number(this.purchaseCost),
      purchasedFrom: this.purchasedFrom,
      siteId: this.siteId,
      state: this.state,
      scrappedAt: this.scrappedAt,
      scrapReason: this.scrapReason,
      notes: this.notes,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Tyre.init(
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
    tyreCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    serialNumber: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    modelName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    size: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    tyreCondition: {
      type: DataTypes.ENUM(...TYRE_CONDITIONS),
      allowNull: false,
      defaultValue: 'new',
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    purchaseCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    purchasedFrom: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    state: {
      type: DataTypes.ENUM(...TYRE_STATES),
      allowNull: false,
      defaultValue: 'in_stock',
    },
    scrappedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    scrapReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...TYRE_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archivedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
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
    modelName: 'Tyre',
    tableName: 'tyres',
  }
);

Tyre.STATUSES = TYRE_STATUSES;
Tyre.STATES = TYRE_STATES;
Tyre.CONDITIONS = TYRE_CONDITIONS;

module.exports = Tyre;
