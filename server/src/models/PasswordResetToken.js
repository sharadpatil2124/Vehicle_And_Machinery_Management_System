const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class PasswordResetToken extends Model {
  get isUsable() {
    return this.usedAt === null && this.expiresAt > new Date();
  }
}

PasswordResetToken.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    tokenHash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'PasswordResetToken',
    tableName: 'password_reset_tokens',
  }
);

module.exports = PasswordResetToken;
