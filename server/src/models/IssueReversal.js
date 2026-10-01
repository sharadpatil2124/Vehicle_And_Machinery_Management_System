const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class IssueReversal extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      assetIssueId: this.assetIssueId,
      reversalNumber: this.reversalNumber,
      reversalDateTime: this.reversalDateTime,
      reason: this.reason,
      reversedBy: this.reversedBy,
      createdAt: this.createdAt,
    };
  }
}

IssueReversal.init(
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
    reversalNumber: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    reversalDateTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reversedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'IssueReversal',
    tableName: 'issue_reversals',
    updatedAt: false,
  }
);

module.exports = IssueReversal;
