const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class AuditLog extends Model {}

AuditLog.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tenantId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
    },
    entityType: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    entityId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    before: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    after: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    updatedAt: false,
  }
);

module.exports = AuditLog;
