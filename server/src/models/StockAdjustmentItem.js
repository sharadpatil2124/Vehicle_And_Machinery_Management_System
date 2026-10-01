const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StockAdjustmentItem extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      adjustmentId: this.adjustmentId,
      itemId: this.itemId,
      storageLocationId: this.storageLocationId,
      uomId: this.uomId,
      systemQuantity: Number(this.systemQuantity),
      countedQuantity: Number(this.countedQuantity),
      adjustmentQuantity: Number(this.adjustmentQuantity),
      unitCost: Number(this.unitCost),
      inventoryTransactionId: this.inventoryTransactionId,
      createdAt: this.createdAt,
    };
  }
}

StockAdjustmentItem.init(
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
    adjustmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'stock_adjustments', key: 'id' },
    },
    itemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
    },
    storageLocationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
    },
    uomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
    },
    systemQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    countedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    adjustmentQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    inventoryTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'StockAdjustmentItem',
    tableName: 'stock_adjustment_items',
    updatedAt: false,
  }
);

module.exports = StockAdjustmentItem;
