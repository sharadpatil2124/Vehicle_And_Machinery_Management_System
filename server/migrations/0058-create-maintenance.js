const { DataTypes } = require('sequelize');

const userReference = {
  type: DataTypes.INTEGER.UNSIGNED,
  references: { model: 'users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
};

async function up({ context: queryInterface }) {
  if (await queryInterface.tableExists('maintenance')) {
    throw new Error(
      'A "maintenance" table already exists but was not created by this migration. ' +
        'Rename or drop it, then run the migration again.'
    );
  }

  await queryInterface.createTable('maintenance', {
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
      allowNull: true,
      references: { model: 'sites', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    type: { type: DataTypes.ENUM('preventive', 'breakdown'), allowNull: false },
    stage: {
      type: DataTypes.ENUM('reported', 'in_progress', 'resolved'),
      allowNull: false,
      defaultValue: 'reported',
    },
    reported_at: { type: DataTypes.DATE, allowNull: false },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    performed_by: { type: DataTypes.STRING(150), allowNull: true },
    labour_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    downtime_minutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    meter_reading: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
    meter_type: { type: DataTypes.ENUM('KM', 'HOURS'), allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    archived_by: { ...userReference, allowNull: true },
    created_by: { ...userReference, allowNull: false },
    updated_by: { ...userReference, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.addIndex('maintenance', ['tenant_id', 'asset_type', 'asset_id', 'type'], {
    name: 'ix_maintenance_tenant_asset_type',
  });
  await queryInterface.addIndex('maintenance', ['tenant_id', 'stage'], {
    name: 'ix_maintenance_tenant_stage',
  });
  await queryInterface.addIndex('maintenance', ['tenant_id', 'completed_at'], {
    name: 'ix_maintenance_tenant_completed',
  });
  await queryInterface.addIndex('maintenance', ['tenant_id', 'status', 'reported_at'], {
    name: 'ix_maintenance_tenant_status_reported',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('maintenance');
}

module.exports = { up, down };
