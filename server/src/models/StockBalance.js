const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class StockBalance extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      siteId: this.siteId,
      itemId: this.itemId,
      storageLocationId: this.storageLocationId,
      quantityOnHand: Number(this.quantityOnHand),
      reservedQuantity: Number(this.reservedQuantity),
      availableQuantity: Number(this.availableQuantity),
      averageUnitCost: Number(this.averageUnitCost),
      lastTransactionAt: this.lastTransactionAt,
      updatedAt: this.updatedAt,
    };
  }
}

StockBalance.init(
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
    quantityOnHand: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    reservedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    availableQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    averageUnitCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    lastTransactionAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'StockBalance',
    tableName: 'stock_balances',
    createdAt: false,
  }
);

module.exports = StockBalance;
