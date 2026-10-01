const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('purchase_items', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    purchase_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'purchases', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    item_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    storage_location_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'storage_locations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    uom_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'units_of_measure', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    purchased_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    received_quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    unit_price: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    tax_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    line_total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    batch_number: { type: DataTypes.STRING(64), allowNull: true },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
    line_status: {
      type: DataTypes.ENUM('pending', 'received'),
      allowNull: false,
      defaultValue: 'pending',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('purchase_items', ['tenant_id', 'purchase_id'], {
    name: 'ix_purchase_items_tenant_purchase',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('purchase_items');
}

module.exports = { up, down };
