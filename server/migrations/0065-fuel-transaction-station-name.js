const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('fuel_transactions', 'fuel_station_name', {
    type: DataTypes.STRING(150),
    allowNull: true,
    after: 'fuel_station_id',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('fuel_transactions', 'fuel_station_name');
}

module.exports = { up, down };
