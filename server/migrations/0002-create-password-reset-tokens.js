const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('password_reset_tokens', {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    token_hash: { type: DataTypes.CHAR(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('password_reset_tokens', {
    type: 'unique',
    fields: ['token_hash'],
    name: 'uq_password_reset_tokens_hash',
  });

  await queryInterface.addIndex('password_reset_tokens', ['user_id', 'used_at'], {
    name: 'ix_password_reset_tokens_user',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('password_reset_tokens');
}

module.exports = { up, down };
