const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const TENANT_STATUSES = ['active', 'suspended', 'inactive'];

class Tenant extends Model {
  get isActive() {
    return this.status === 'active';
  }
}

Tenant.init(
  {
    tenantId: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      field: 'tenant_id',
    },
    organizationName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...TENANT_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    modelName: 'Tenant',
    tableName: 'tenants',
  }
);

Tenant.STATUSES = TENANT_STATUSES;

module.exports = Tenant;
