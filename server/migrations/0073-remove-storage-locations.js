const { DataTypes, QueryTypes } = require('sequelize');

// Stock is now held per site. Stock kept in several storage locations at one site becomes one balance,
// and every batch keeps its own price and date, so quantities and stock value do not change.
// The locations, and which location each past document used, are removed for good:
// `down` restores the tables with one "Main store" per site, not the original locations.

const LOCATION_COLUMNS = [
  { table: 'stock_balances', column: 'storage_location_id' },
  { table: 'stock_batches', column: 'storage_location_id' },
  { table: 'inventory_transactions', column: 'storage_location_id' },
  { table: 'purchase_items', column: 'storage_location_id', parent: { table: 'purchases', key: 'purchase_id', site: 'site_id' } },
  { table: 'asset_issue_items', column: 'storage_location_id', parent: { table: 'asset_issues', key: 'asset_issue_id', site: 'site_id' } },
  { table: 'stock_adjustment_items', column: 'storage_location_id', parent: { table: 'stock_adjustments', key: 'adjustment_id', site: 'site_id' } },
  { table: 'stock_transfer_items', column: 'from_storage_location_id', parent: { table: 'stock_transfers', key: 'stock_transfer_id', site: 'from_site_id' } },
  { table: 'stock_transfer_items', column: 'to_storage_location_id', parent: { table: 'stock_transfers', key: 'stock_transfer_id', site: 'to_site_id' } },
];

// Each index that names a location, and the same index without it.
const INDEX_CHANGES = [
  {
    table: 'stock_balances',
    unique: true,
    withLocation: { name: 'uq_stock_balances_site_item_location', fields: ['tenant_id', 'site_id', 'item_id', 'storage_location_id'] },
    withoutLocation: { name: 'uq_stock_balances_site_item', fields: ['tenant_id', 'site_id', 'item_id'] },
  },
  {
    table: 'stock_batches',
    withLocation: { name: 'ix_stock_batches_balance_age', fields: ['tenant_id', 'site_id', 'item_id', 'storage_location_id', 'received_at', 'id'] },
    withoutLocation: { name: 'ix_stock_batches_site_item_age', fields: ['tenant_id', 'site_id', 'item_id', 'received_at', 'id'] },
  },
  {
    table: 'inventory_transactions',
    withLocation: { name: 'ix_inventory_transactions_tenant_site_item_location', fields: ['tenant_id', 'site_id', 'item_id', 'storage_location_id'] },
    withoutLocation: { name: 'ix_inventory_transactions_tenant_site_item', fields: ['tenant_id', 'site_id', 'item_id'] },
  },
];

async function columnExists(sequelize, table, column) {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function indexExists(sequelize, table, name) {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :name LIMIT 1`,
    { replacements: { table, name }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function addIndexOnce(queryInterface, table, { name, fields }, unique = false) {
  if (await indexExists(queryInterface.sequelize, table, name)) return;
  await queryInterface.addIndex(table, fields, { name, unique });
}

async function removeIndexOnce(queryInterface, table, name) {
  if (await indexExists(queryInterface.sequelize, table, name)) await queryInterface.removeIndex(table, name);
}

// The names of the keys and indexes are looked up, because databases built at different times name them differently.
async function dropLocationColumn(queryInterface, { table, column }) {
  const { sequelize } = queryInterface;
  if (!(await columnExists(sequelize, table, column))) return;

  const foreignKeys = await sequelize.query(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  for (const { name } of foreignKeys) await queryInterface.removeConstraint(table, name);

  const indexes = await sequelize.query(
    `SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  for (const { name } of indexes) await queryInterface.removeIndex(table, name);

  await queryInterface.removeColumn(table, column);
}

// One balance per site and item: the quantities add up, and the average cost is weighted by quantity.
async function mergeBalances(sequelize) {
  await sequelize.transaction(async (transaction) => {
    const groups = await sequelize.query(
      `SELECT MIN(id) AS keepId,
              tenant_id AS tenantId, site_id AS siteId, item_id AS itemId,
              SUM(quantity_on_hand) AS quantityOnHand,
              SUM(reserved_quantity) AS reservedQuantity,
              SUM(available_quantity) AS availableQuantity,
              SUM(quantity_on_hand * average_unit_cost) / NULLIF(SUM(quantity_on_hand), 0) AS averageUnitCost,
              MAX(last_transaction_at) AS lastTransactionAt,
              MAX(updated_at) AS updatedAt
         FROM stock_balances
        GROUP BY tenant_id, site_id, item_id
       HAVING COUNT(*) > 1
          FOR UPDATE`,
      { type: QueryTypes.SELECT, transaction }
    );

    for (const group of groups) {
      await sequelize.query(
        `UPDATE stock_balances
            SET quantity_on_hand = :quantityOnHand,
                reserved_quantity = :reservedQuantity,
                available_quantity = :availableQuantity,
                average_unit_cost = COALESCE(:averageUnitCost, average_unit_cost),
                last_transaction_at = :lastTransactionAt,
                updated_at = :updatedAt
          WHERE id = :keepId`,
        { replacements: group, transaction }
      );
      await sequelize.query(
        `DELETE FROM stock_balances
          WHERE tenant_id = :tenantId AND site_id = :siteId AND item_id = :itemId AND id <> :keepId`,
        { replacements: group, transaction }
      );
    }
  });
}

async function up({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  if (await queryInterface.tableExists('storage_locations')) {
    await mergeBalances(sequelize);
  }

  // The new index goes in first: an old one may be the index a foreign key on tenant_id relies on.
  for (const change of INDEX_CHANGES) {
    await addIndexOnce(queryInterface, change.table, change.withoutLocation, change.unique);
  }
  for (const change of INDEX_CHANGES) {
    await removeIndexOnce(queryInterface, change.table, change.withLocation.name);
  }

  for (const column of LOCATION_COLUMNS) {
    await dropLocationColumn(queryInterface, column);
  }

  await sequelize.query("DELETE FROM code_counters WHERE counter_key LIKE 'storage\\_locations:%'");

  if (await queryInterface.tableExists('storage_locations')) {
    await queryInterface.dropTable('storage_locations');
  }
}

async function restoreLocationColumn(queryInterface, { table, column, parent }) {
  const { sequelize } = queryInterface;

  await queryInterface.addColumn(table, column, { type: DataTypes.INTEGER.UNSIGNED, allowNull: true });

  if (parent) {
    await sequelize.query(
      `UPDATE ${table} line
         JOIN ${parent.table} doc ON doc.id = line.${parent.key}
         JOIN storage_locations loc ON loc.site_id = doc.${parent.site}
          SET line.${column} = loc.id`
    );
  } else {
    await sequelize.query(
      `UPDATE ${table} row_to_fill
         JOIN storage_locations loc ON loc.site_id = row_to_fill.site_id
          SET row_to_fill.${column} = loc.id`
    );
  }

  await queryInterface.changeColumn(table, column, { type: DataTypes.INTEGER.UNSIGNED, allowNull: false });
  await queryInterface.addConstraint(table, {
    type: 'foreign key',
    fields: [column],
    name: `fk_${table}_${column}`,
    references: { table: 'storage_locations', field: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });
}

async function down({ context: queryInterface }) {
  const { sequelize } = queryInterface;

  const userColumn = {
    type: DataTypes.INTEGER.UNSIGNED,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  };

  await queryInterface.createTable('storage_locations', {
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
    location_code: { type: DataTypes.STRING(64), allowNull: false },
    location_name: { type: DataTypes.STRING(150), allowNull: false },
    status: { type: DataTypes.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
    archived_at: { type: DataTypes.DATE, allowNull: true },
    archived_by: { ...userColumn, allowNull: true },
    created_by: { ...userColumn, allowNull: false },
    updated_by: { ...userColumn, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addConstraint('storage_locations', {
    type: 'unique',
    fields: ['tenant_id', 'site_id', 'location_code'],
    name: 'uq_storage_locations_site_code',
  });
  await queryInterface.addIndex('storage_locations', ['tenant_id', 'status'], { name: 'ix_storage_locations_tenant_status' });
  await queryInterface.addIndex('storage_locations', ['tenant_id', 'site_id'], { name: 'ix_storage_locations_tenant_site' });

  await sequelize.query(
    `INSERT INTO storage_locations (tenant_id, site_id, location_code, location_name, status, created_by, updated_by, created_at, updated_at)
     SELECT tenant_id, id,
            CONCAT('LOC-', LPAD(ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id), 6, '0')),
            'Main store', 'active', created_by, created_by, NOW(), NOW()
       FROM sites`
  );

  for (const column of LOCATION_COLUMNS) {
    await restoreLocationColumn(queryInterface, column);
  }

  for (const change of INDEX_CHANGES) {
    await addIndexOnce(queryInterface, change.table, change.withLocation, change.unique);
  }
  for (const change of INDEX_CHANGES) {
    await removeIndexOnce(queryInterface, change.table, change.withoutLocation.name);
  }
}

module.exports = { up, down };
