const { DataTypes } = require('sequelize');

const createFuelStockAdjustments = require('./0047-create-fuel-stock-adjustments');

async function up({ context: queryInterface }) {
  const [[{ n }]] = await queryInterface.sequelize.query(
    "SELECT COUNT(*) AS n FROM fuel_stock_ledger WHERE entry_type = 'ADJUSTMENT' OR reference_type = 'FUEL_STOCK_ADJUSTMENT'"
  );
  if (Number(n) > 0) {
    throw new Error(
      `fuel_stock_ledger has ${n} stock-check entries. Removing them would change site fuel stock, so this migration stops here.`
    );
  }

  await queryInterface.dropTable('fuel_stock_adjustments');

  await queryInterface.changeColumn('fuel_stock_ledger', 'entry_type', {
    type: DataTypes.ENUM('RECEIPT', 'ISSUE', 'ISSUE_REVERSAL'),
    allowNull: false,
  });
  await queryInterface.changeColumn('fuel_stock_ledger', 'reference_type', {
    type: DataTypes.ENUM('FUEL_COLLECTION', 'FUEL_TRANSACTION'),
    allowNull: false,
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.changeColumn('fuel_stock_ledger', 'entry_type', {
    type: DataTypes.ENUM('RECEIPT', 'ISSUE', 'ISSUE_REVERSAL', 'ADJUSTMENT'),
    allowNull: false,
  });
  await queryInterface.changeColumn('fuel_stock_ledger', 'reference_type', {
    type: DataTypes.ENUM('FUEL_COLLECTION', 'FUEL_TRANSACTION', 'FUEL_STOCK_ADJUSTMENT'),
    allowNull: false,
  });

  await createFuelStockAdjustments.up({ context: queryInterface });
}

module.exports = { up, down };
