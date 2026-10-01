const { DataTypes } = require('sequelize');

async function up({ context: queryInterface }) {
  await queryInterface.createTable('purchases', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    supplier_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'suppliers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    purchase_number: { type: DataTypes.STRING(64), allowNull: false },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: false },
    subtotal_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    currency_code: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'INR' },
    status: {
      type: DataTypes.ENUM('draft', 'received'),
      allowNull: false,
      defaultValue: 'draft',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('purchases', {
    type: 'unique',
    fields: ['tenant_id', 'purchase_number'],
    name: 'uq_purchases_tenant_number',
  });

  await queryInterface.addIndex('purchases', ['tenant_id', 'site_id', 'status'], {
    name: 'ix_purchases_tenant_site_status',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('purchases');
}

module.exports = { up, down };
