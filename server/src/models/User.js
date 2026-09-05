const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const { ROLES } = require('../config/permissions');

const USER_STATUSES = ['active', 'inactive'];

class User extends Model {
  get isActive() {
    return this.status === 'active';
  }

  get isAdmin() {
    return this.role === ROLES.ADMIN;
  }

  toPublicJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      status: this.status,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
    };
  }
}

User.init(
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
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(ROLES.ADMIN, ROLES.SUPERVISOR),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...USER_STATUSES),
      allowNull: false,
      defaultValue: 'active',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    defaultScope: {
      attributes: { exclude: ['passwordHash'] },
    },
    scopes: {
      withPassword: { attributes: { include: ['passwordHash'] } },
    },
  }
);

User.STATUSES = USER_STATUSES;

module.exports = User;
