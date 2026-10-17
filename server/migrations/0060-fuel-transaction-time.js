const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('fuel_transactions', 'txn_time', { type: DataTypes.TIME, allowNull: true, after: 'txn_date' });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('fuel_transactions', 'txn_time');
}

module.exports = { up, down };
