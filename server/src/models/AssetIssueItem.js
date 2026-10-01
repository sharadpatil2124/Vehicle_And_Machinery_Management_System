const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class AssetIssueItem extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      assetIssueId: this.assetIssueId,
      itemId: this.itemId,
      storageLocationId: this.storageLocationId,
      uomId: this.uomId,
      issuedQuantity: Number(this.issuedQuantity),
      reversedQuantity: Number(this.reversedQuantity),
      unitCost: Number(this.unitCost),
      totalCost: Number(this.totalCost),
      inventoryTransactionId: this.inventoryTransactionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

AssetIssueItem.init(
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
    assetIssueId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'asset_issues', key: 'id' },
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
    issuedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    reversedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },
    unitCost: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalCost: {
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
    modelName: 'AssetIssueItem',
    tableName: 'asset_issue_items',
  }
);

module.exports = AssetIssueItem;
