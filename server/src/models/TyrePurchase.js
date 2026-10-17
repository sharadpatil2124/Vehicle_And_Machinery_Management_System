const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const TYRE_PURCHASE_STATUSES = ['active', 'cancelled'];

class TyrePurchase extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      purchaseNumber: this.purchaseNumber,
      siteId: this.siteId,
      supplierName: this.supplierName,
      purchaseDate: this.purchaseDate,
      billNumber: this.billNumber,
      tyreCount: this.tyreCount,
      subtotalAmount: Number(this.subtotalAmount),
      taxAmount: Number(this.taxAmount),
      totalAmount: Number(this.totalAmount),
      notes: this.notes,
      status: this.status,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

TyrePurchase.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.STRING(64), allowNull: false, references: { model: 'tenants', key: 'tenant_id' } },
    purchaseNumber: { type: DataTypes.STRING(32), allowNull: false },
    siteId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'sites', key: 'id' } },
    supplierName: { type: DataTypes.STRING(255), allowNull: true },
    purchaseDate: { type: DataTypes.DATEONLY, allowNull: false },
    billNumber: { type: DataTypes.STRING(64), allowNull: true },
    tyreCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    subtotalAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    taxAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    notes: { type: DataTypes.STRING(1000), allowNull: true },
    status: { type: DataTypes.ENUM(...TYRE_PURCHASE_STATUSES), allowNull: false, defaultValue: 'active' },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    cancelledBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, references: { model: 'users', key: 'id' } },
    createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
    updatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
  },
  { sequelize, modelName: 'TyrePurchase', tableName: 'tyre_purchases' }
);

TyrePurchase.STATUSES = TYRE_PURCHASE_STATUSES;

module.exports = TyrePurchase;
