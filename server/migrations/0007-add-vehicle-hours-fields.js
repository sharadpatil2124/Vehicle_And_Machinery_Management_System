const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.changeColumn('vehicles', 'current_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });
  await queryInterface.changeColumn('vehicles', 'service_interval_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });
  await queryInterface.changeColumn('vehicles', 'next_service_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });

  await queryInterface.addColumn('vehicles', 'current_hours', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });
  await queryInterface.addColumn('vehicles', 'service_interval_hours', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });
  await queryInterface.addColumn('vehicles', 'next_service_hours', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('vehicles', 'next_service_hours');
  await queryInterface.removeColumn('vehicles', 'service_interval_hours');
  await queryInterface.removeColumn('vehicles', 'current_hours');

  await queryInterface.changeColumn('vehicles', 'next_service_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  });
  await queryInterface.changeColumn('vehicles', 'service_interval_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  });
  await queryInterface.changeColumn('vehicles', 'current_km', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  });
}

module.exports = { up, down };
