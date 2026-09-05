const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('machinery', 'name', {
    type: DataTypes.STRING(150),
    allowNull: true,
  });
  await queryInterface.addColumn('machinery', 'registration_number', {
    type: DataTypes.STRING(32),
    allowNull: true,
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('machinery', 'registration_number');
  await queryInterface.removeColumn('machinery', 'name');
}

module.exports = { up, down };
