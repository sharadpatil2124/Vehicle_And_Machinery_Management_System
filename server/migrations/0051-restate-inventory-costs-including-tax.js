const FACTORS = `(
  SELECT pi.tenant_id, pi.item_id,
         SUM(pi.received_quantity * (1 + pi.tax_percentage / 100)) / SUM(pi.received_quantity) AS factor
    FROM purchase_items pi
   WHERE pi.received_quantity > 0
   GROUP BY pi.tenant_id, pi.item_id
  HAVING SUM(pi.received_quantity * pi.tax_percentage) > 0
)`;

const RESTATED = [
  { table: 'stock_batches', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['unit_cost', 4]] },
  {
    table: 'stock_batch_movements',
    join: `JOIN stock_batches sb ON sb.id = x.stock_batch_id JOIN ${FACTORS} f ON f.tenant_id = sb.tenant_id AND f.item_id = sb.item_id`,
    columns: [['unit_cost', 4]],
  },
  { table: 'inventory_transactions', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['unit_cost', 2], ['total_cost', 2]] },
  { table: 'asset_issue_items', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['unit_cost', 2], ['total_cost', 2]] },
  { table: 'stock_transfer_items', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['unit_cost', 2], ['total_cost', 2]] },
  { table: 'stock_adjustment_items', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['unit_cost', 2]] },
  { table: 'stock_balances', join: `JOIN ${FACTORS} f ON f.tenant_id = x.tenant_id AND f.item_id = x.item_id`, columns: [['average_unit_cost', 2]] },
];

async function up({ context: queryInterface }) {
  for (const { table, join, columns } of RESTATED) {
    const set = columns.map(([column, places]) => `x.${column} = ROUND(x.${column} * f.factor, ${places})`).join(', ');
    await queryInterface.sequelize.query(`UPDATE ${table} x ${join} SET ${set}`);
  }
}

async function down() {
}

module.exports = { up, down };
