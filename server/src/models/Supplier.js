const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const SUPPLIER_STATUSES = ['active', 'archived'];

class Supplier extends Model {
  toPublicJSON() {
    return {
      id: this.id,
      supplierCode: this.supplierCode,
      supplierName: this.supplierName,
      taxRegistrationNo: this.taxRegistrationNo,
      contactPerson: this.contactPerson,
      phone: this.phone,
      email: this.email,
      address: this.address,
      status: this.status,
      archivedAt: this.archivedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

Supplier.init(
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
    supplierCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    taxRegistrationNo: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    contactPerson: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...SUPPLIER_STATUSES),
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
    modelName: 'Supplier',
    tableName: 'suppliers',
  }
);

Supplier.STATUSES = SUPPLIER_STATUSES;

module.exports = Supplier;
