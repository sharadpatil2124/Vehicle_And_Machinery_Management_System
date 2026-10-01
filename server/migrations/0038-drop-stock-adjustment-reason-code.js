const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeColumn('stock_adjustments', 'reason_code');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('stock_adjustments', 'reason_code', {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
}

module.exports = { up, down };
