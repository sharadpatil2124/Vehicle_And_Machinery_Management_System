const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const UOM_STATUSES = ['active', 'archived'];

class UnitOfMeasure extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      uomCode: this.uomCode,
      uomName: this.uomName,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

UnitOfMeasure.init(
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
    uomCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    uomName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...UOM_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archivedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    updatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    modelName: 'UnitOfMeasure',
    tableName: 'units_of_measure',
  }
);

UnitOfMeasure.STATUSES = UOM_STATUSES;

module.exports = UnitOfMeasure;
