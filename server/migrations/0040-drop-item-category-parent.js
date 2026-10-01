const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.removeConstraint('item_categories', 'item_categories_ibfk_2');
  await queryInterface.removeColumn('item_categories', 'parent_category_id');
}

async function down({ context: queryInterface }) {
  await queryInterface.addColumn('item_categories', 'parent_category_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'item_categories', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });
}

module.exports = { up, down };
