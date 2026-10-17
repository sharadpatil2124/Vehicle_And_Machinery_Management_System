const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class TyrePurchaseItem extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      purchaseId: this.purchaseId,
      tyreTypeId: this.tyreTypeId,
      quantity: this.quantity,
      unitPrice: Number(this.unitPrice),
      taxPercentage: Number(this.taxPercentage),
      unitCost: Number(this.unitCost),
      lineTotal: Number(this.lineTotal),
    };
  }
}

TyrePurchaseItem.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.STRING(64), allowNull: false, references: { model: 'tenants', key: 'tenant_id' } },
    purchaseId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'tyre_purchases', key: 'id' } },
    tyreTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'tyre_types', key: 'id' } },
    quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    taxPercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    lineTotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  },
  { sequelize, modelName: 'TyrePurchaseItem', tableName: 'tyre_purchase_items' }
);

module.exports = TyrePurchaseItem;
