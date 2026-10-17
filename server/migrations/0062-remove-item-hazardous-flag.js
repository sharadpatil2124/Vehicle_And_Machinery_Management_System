const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeColumn('items', 'is_hazardous');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('items', 'is_hazardous', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, after: 'item_type' });
}

module.exports = { up, down };
