const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const PURCHASE_STATUSES = ['draft', 'received'];

class Purchase extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      supplierId: this.supplierId,
      purchaseNumber: this.purchaseNumber,
      purchaseDate: this.purchaseDate,
      subtotalAmount: Number(this.subtotalAmount),
      taxAmount: Number(this.taxAmount),
      totalAmount: Number(this.totalAmount),
      currencyCode: this.currencyCode,
      status: this.status,
      remarks: this.remarks,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Purchase.init(
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
    siteId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
    },
    supplierId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'suppliers', key: 'id' },
    },
    purchaseNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    subtotalAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currencyCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'INR',
    },
    status: {
      type: DataTypes.ENUM(...PURCHASE_STATUSES),
      allowNull: false,
      defaultValue: 'draft',
    },
    remarks: {
      type: DataTypes.TEXT,
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
    modelName: 'Purchase',
    tableName: 'purchases',
  }
);

Purchase.STATUSES = PURCHASE_STATUSES;

module.exports = Purchase;
