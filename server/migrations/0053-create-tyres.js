const { DataTypes } = require('sequelize');

const userRef = {
  type: DataTypes.INTEGER.UNSIGNED,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
};

async function up({ context: queryInterface }) {
  await queryInterface.createTable('tyres', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    tenant_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: 'tenants', key: 'tenant_id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    tyre_code: { type: DataTypes.STRING(64), allowNull: false },
    serial_number: { type: DataTypes.STRING(64), allowNull: true },
    brand: { type: DataTypes.STRING(100), allowNull: false },
    model_name: { type: DataTypes.STRING(100), allowNull: true },
    size: { type: DataTypes.STRING(50), allowNull: false },
    tyre_condition: {
      type: DataTypes.ENUM('new', 'retreaded'),
      allowNull: false,
      defaultValue: 'new',
    },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: true },
    purchase_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    purchased_from: { type: DataTypes.STRING(255), allowNull: true },
    site_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    state: {
      type: DataTypes.ENUM('in_stock', 'fitted', 'scrapped'),
      allowNull: false,
      defaultValue: 'in_stock',
    },
    scrapped_at: { type: DataTypes.DATEONLY, allowNull: true },
    scrap_reason: { type: DataTypes.STRING(500), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    archived_by: { ...userRef, allowNull: true },
    created_by: { ...userRef, allowNull: false },
    updated_by: { ...userRef, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addConstraint('tyres', {
    type: 'unique',
    fields: ['tenant_id', 'tyre_code'],
    name: 'uq_tyres_tenant_code',
  });

  await queryInterface.addConstraint('tyres', {
    type: 'unique',
    fields: ['tenant_id', 'serial_number'],
    name: 'uq_tyres_tenant_serial',
  });

  await queryInterface.addIndex('tyres', ['tenant_id', 'status'], { name: 'ix_tyres_tenant_status' });
  await queryInterface.addIndex('tyres', ['tenant_id', 'state', 'site_id'], { name: 'ix_tyres_tenant_state_site' });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('tyres');
}

module.exports = { up, down };
