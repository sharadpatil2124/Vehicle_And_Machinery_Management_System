const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeColumn('units_of_measure', 'conversion_factor');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('units_of_measure', 'conversion_factor', {
    type: DataTypes.DECIMAL(14, 6),
    allowNull: false,
    defaultValue: 1,
  });
}

module.exports = { up, down };
