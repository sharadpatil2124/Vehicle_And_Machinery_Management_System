const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  if (await queryInterface.tableExists('code_counters')) {
    throw new Error('Table code_counters already exists: remove or rename it, then run the migration again');
  }

  await queryInterface.createTable('code_counters', {
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    counter_key: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
    highest_used: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('code_counters');
}

module.exports = { up, down };
