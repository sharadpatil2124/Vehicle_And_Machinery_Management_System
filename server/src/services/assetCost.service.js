const { QueryTypes } = require('sequelize');

const { sequelize, Maintenance, TyreFitment } = require('../models');
const { roundMoney } = require('./fuelCommon');

const num = (value) => (value == null ? 0 : Number(value));

async function inventoryCost({ tenantId, assetType, assetId }) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'ISSUE' THEN t.total_cost ELSE 0 END), 0) AS issued,
            COALESCE(SUM(CASE WHEN t.transaction_type = 'ISSUE_REVERSAL' THEN t.total_cost ELSE 0 END), 0) AS returned
       FROM inventory_transactions t
       LEFT JOIN asset_issue_items aii
              ON t.transaction_type = 'ISSUE' AND t.reference_type = 'ASSET_ISSUE_ITEM' AND aii.id = t.reference_id
       LEFT JOIN issue_reversal_items iri
              ON t.transaction_type = 'ISSUE_REVERSAL' AND t.reference_type = 'ISSUE_REVERSAL_ITEM' AND iri.id = t.reference_id
       LEFT JOIN asset_issue_items original ON original.id = iri.asset_issue_item_id
       JOIN asset_issues ai ON ai.id = COALESCE(aii.asset_issue_id, original.asset_issue_id)
      WHERE t.tenant_id = :tenantId AND t.status = 'posted' AND t.transaction_type IN ('ISSUE', 'ISSUE_REVERSAL')
        AND ai.tenant_id = :tenantId AND ai.asset_type = :assetType AND ai.asset_id = :assetId`,
    { replacements: { tenantId, assetType, assetId }, type: QueryTypes.SELECT }
  );
  return roundMoney(num(row?.issued) - num(row?.returned));
}

async function assetCostSummary({ tenantId, assetType, assetId }) {
  const [maintenance, inventory, tyres] = await Promise.all([
    Maintenance.sum('totalCost', { where: { tenantId, assetType, assetId, status: 'active' } }),
    inventoryCost({ tenantId, assetType, assetId }),
    TyreFitment.sum('unitCost', { where: { tenantId, assetType, assetId } }),
  ]);
  const breakdown = {
    maintenance: roundMoney(num(maintenance)),
    inventory: roundMoney(num(inventory)),
    tyres: roundMoney(num(tyres)),
  };
  return {
    assetType,
    assetId,
    ...breakdown,
    total: roundMoney(breakdown.maintenance + breakdown.inventory + breakdown.tyres),
  };
}

module.exports = { assetCostSummary };
