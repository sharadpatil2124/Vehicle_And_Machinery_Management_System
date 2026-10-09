const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('fuel_collection_containers', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    collection_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'fuel_collections', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    container_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    litres_per_container: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('fuel_collection_containers', ['tenant_id', 'collection_id'], {
    name: 'ix_fuel_collection_containers_tenant_collection',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('fuel_collection_containers');
}

module.exports = { up, down };
