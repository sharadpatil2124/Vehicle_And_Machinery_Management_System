const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('users', 'sessions_revoked_at', {
    type: DataTypes.DATE(3),
    allowNull: true,
    after: 'last_login_at',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('users', 'sessions_revoked_at');
}

module.exports = { up, down };
