const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.changeColumn('vehicles', 'fuel_type', {
    type: DataTypes.ENUM('Diesel', 'Petrol', 'CNG'),
    allowNull: false,
  });
  await queryInterface.changeColumn('machinery', 'fuel_type', {
    type: DataTypes.ENUM('Diesel', 'Petrol', 'CNG'),
    allowNull: false,
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.changeColumn('vehicles', 'fuel_type', {
    type: DataTypes.STRING(50),
    allowNull: false,
  });
  await queryInterface.changeColumn('machinery', 'fuel_type', {
    type: DataTypes.STRING(50),
    allowNull: false,
  });
}

module.exports = { up, down };
