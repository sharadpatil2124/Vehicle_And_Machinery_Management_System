const { DataTypes } = require('sequelize');

const FK_COLUMNS = ['fuel_station_id', 'ledger_entry_id', 'reversal_ledger_entry_id'];

async function up({ context: queryInterface }) {
  await queryInterface.addColumn('fuel_transactions', 'source', {
    type: DataTypes.ENUM('SITE_STOCK', 'DIRECT_PUMP'),
    allowNull: false,
    defaultValue: 'DIRECT_PUMP',
  });

  await queryInterface.addColumn('fuel_transactions', 'fuel_type', {
    type: DataTypes.ENUM('Diesel', 'Petrol', 'CNG'),
    allowNull: true,
  });

  await queryInterface.addColumn('fuel_transactions', 'fuel_station_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'fuel_stations', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await queryInterface.addColumn('fuel_transactions', 'ledger_entry_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'fuel_stock_ledger', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await queryInterface.addColumn('fuel_transactions', 'reversal_ledger_entry_id', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: 'fuel_stock_ledger', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await queryInterface.changeColumn('fuel_transactions', 'price_per_litre', {
    type: DataTypes.DECIMAL(14, 4),
    allowNull: false,
  });

  await queryInterface.sequelize.query(`
    UPDATE fuel_transactions ft
    JOIN vehicles v ON v.tenant_id = ft.tenant_id AND v.asset_id = ft.asset_id
    SET ft.fuel_type = v.fuel_type
    WHERE ft.asset_type = 'VEHICLE' AND ft.fuel_type IS NULL
  `);
  await queryInterface.sequelize.query(`
    UPDATE fuel_transactions ft
    JOIN machinery m ON m.tenant_id = ft.tenant_id AND m.asset_id = ft.asset_id
    SET ft.fuel_type = m.fuel_type
    WHERE ft.asset_type = 'MACHINERY' AND ft.fuel_type IS NULL
  `);

  await queryInterface.addIndex('fuel_transactions', ['tenant_id', 'source'], {
    name: 'ix_fuel_transactions_tenant_source',
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeIndex('fuel_transactions', 'ix_fuel_transactions_tenant_source');

  const references = await queryInterface.getForeignKeyReferencesForTable('fuel_transactions');
  for (const reference of references) {
    if (FK_COLUMNS.includes(reference.columnName)) {
      await queryInterface.removeConstraint('fuel_transactions', reference.constraintName);
    }
  }

  for (const column of [...FK_COLUMNS, 'fuel_type', 'source']) {
    await queryInterface.removeColumn('fuel_transactions', column);
  }

  await queryInterface.changeColumn('fuel_transactions', 'price_per_litre', {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  });
}

module.exports = { up, down };
