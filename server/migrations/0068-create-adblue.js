const { DataTypes } = require('sequelize');

const TABLES = ['adblue_purchases', 'adblue_fillings'];

function commonColumns() {
  return {
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
  };
}

function amountAndAuditColumns() {
  return {
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    rate_per_litre: { type: DataTypes.DECIMAL(14, 4), allowNull: false },
    total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    archived_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
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
  };
}

async function up({ context: queryInterface }) {
  for (const table of TABLES) {
    if (await queryInterface.tableExists(table)) {
      throw new Error(`Table "${table}" already exists. Rename or drop it before running this migration.`);
    }
  }

  await queryInterface.createTable('adblue_purchases', {
    ...commonColumns(),
    supplier_name: { type: DataTypes.STRING(255), allowNull: false },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: false },
    ...amountAndAuditColumns(),
  });

  await queryInterface.addIndex('adblue_purchases', ['tenant_id', 'site_id', 'status'], {
    name: 'ix_adblue_purchases_tenant_site_status',
  });
  await queryInterface.addIndex('adblue_purchases', ['tenant_id', 'purchase_date'], {
    name: 'ix_adblue_purchases_tenant_date',
  });

  await queryInterface.createTable('adblue_fillings', {
    ...commonColumns(),
    asset_type: { type: DataTypes.ENUM('VEHICLE', 'MACHINERY'), allowNull: false },
    asset_id: { type: DataTypes.STRING(64), allowNull: false },
    filling_date: { type: DataTypes.DATEONLY, allowNull: false },
    ...amountAndAuditColumns(),
  });

  await queryInterface.addIndex('adblue_fillings', ['tenant_id', 'site_id', 'status'], {
    name: 'ix_adblue_fillings_tenant_site_status',
  });
  await queryInterface.addIndex('adblue_fillings', ['tenant_id', 'asset_type', 'asset_id', 'filling_date'], {
    name: 'ix_adblue_fillings_tenant_asset_date',
  });
  await queryInterface.addIndex('adblue_fillings', ['tenant_id', 'filling_date'], {
    name: 'ix_adblue_fillings_tenant_date',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.dropTable('adblue_fillings');
  await queryInterface.dropTable('adblue_purchases');
}

module.exports = { up, down };
