const { DataTypes } = require('sequelize');

async function foreignKeysOn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: { table, column } }
  );
  return rows.map((r) => r.name);
}

async function up({ context: queryInterface }) {
  for (const name of await foreignKeysOn(queryInterface, 'tyre_purchases', 'supplier_id')) {
    await queryInterface.removeConstraint('tyre_purchases', name);
  }
  await queryInterface.removeColumn('tyre_purchases', 'supplier_id');
  await queryInterface.addColumn('tyre_purchases', 'supplier_name', { type: DataTypes.STRING(255), allowNull: true, after: 'site_id' });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('tyre_purchases', 'supplier_name');
  await queryInterface.addColumn('tyre_purchases', 'supplier_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    after: 'site_id',
    references: { model: 'suppliers', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });
}

module.exports = { up, down };
