const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeColumn('vehicles', 'category');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('vehicles', 'category', {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Unspecified',
  });
}

module.exports = { up, down };
