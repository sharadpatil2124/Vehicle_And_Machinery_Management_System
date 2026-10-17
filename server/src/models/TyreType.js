const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const TYRE_TYPE_STATUSES = ['active', 'archived'];

class TyreType extends Model {
  get label() {
    return [this.brand, this.pattern].filter(Boolean).join(' ');
  }

  toPublicJSON() {
    return {
      id: this.id,
      typeCode: this.typeCode,
      brand: this.brand,
      pattern: this.pattern || null,
      size: this.size,
      label: this.label,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

TyreType.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenantId: { type: DataTypes.STRING(64), allowNull: false, references: { model: 'tenants', key: 'tenant_id' } },
    typeCode: { type: DataTypes.STRING(32), allowNull: false },
    brand: { type: DataTypes.STRING(100), allowNull: false },
    pattern: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    size: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM(...TYRE_TYPE_STATUSES), allowNull: false, defaultValue: 'active' },
    createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
    updatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' } },
  },
  { sequelize, modelName: 'TyreType', tableName: 'tyre_types' }
);

TyreType.STATUSES = TYRE_TYPE_STATUSES;

module.exports = TyreType;
