const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class IssueReversalItem extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      issueReversalId: this.issueReversalId,
      assetIssueItemId: this.assetIssueItemId,
      reversedQuantity: Number(this.reversedQuantity),
      inventoryTransactionId: this.inventoryTransactionId,
      createdAt: this.createdAt,
    };
  }
}

IssueReversalItem.init(
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
    issueReversalId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'issue_reversals', key: 'id' },
    },
    assetIssueItemId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'asset_issue_items', key: 'id' },
    },
    reversedQuantity: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
    },
    inventoryTransactionId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'inventory_transactions', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'IssueReversalItem',
    tableName: 'issue_reversal_items',
    updatedAt: false,
  }
);

module.exports = IssueReversalItem;
