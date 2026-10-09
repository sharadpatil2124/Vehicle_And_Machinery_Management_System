const { QueryTypes } = require('sequelize');

const { sequelize, Vehicle } = require('../models');
const { hasPermission } = require('../config/permissions');
const { supervisorSiteId } = require('./siteAccess');
const { todayDateOnly, roundMoney, roundQuantity } = require('./fuelCommon');

const TREND_MONTHS = 6;

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateOnly(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function query(sql, replacements) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

function num(value) {
  return value == null ? 0 : Number(value);
}

async function fleetSummary(tenantId, siteClause, replacements) {
  const [vehicles] = await query(
    `SELECT COUNT(*) AS total,
            SUM(CASE
                  WHEN type = :hoursType THEN current_hours IS NOT NULL AND next_service_hours IS NOT NULL AND current_hours >= next_service_hours
                  ELSE current_km IS NOT NULL AND next_service_km IS NOT NULL AND current_km >= next_service_km
                END) AS serviceDue
       FROM vehicles
      WHERE tenant_id = :tenantId AND status = 'active'${siteClause('current_site_id')}`,
    { ...replacements, hoursType: Vehicle.HOURS_BASED_TYPE }
  );

  const [machinery] = await query(
    `SELECT COUNT(*) AS total,
            SUM(current_hours IS NOT NULL AND next_service_hours IS NOT NULL AND current_hours >= next_service_hours) AS serviceDue
       FROM machinery
      WHERE tenant_id = :tenantId AND status = 'active'${siteClause('current_site_id')}`,
    replacements
  );

  let sites = 1;
  if (!replacements.siteId) {
    const [row] = await query(`SELECT COUNT(*) AS total FROM sites WHERE tenant_id = :tenantId AND status = 'active'`, replacements);
    sites = num(row.total);
  }

  return {
    vehicles: num(vehicles.total),
    machinery: num(machinery.total),
    sites,
    serviceDue: {
      vehicles: num(vehicles.serviceDue),
      machinery: num(machinery.serviceDue),
      total: num(vehicles.serviceDue) + num(machinery.serviceDue),
    },
  };
}

async function fuelSummary(tenantId, siteClause, replacements) {
  const [used] = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS litres, COALESCE(SUM(amount), 0) AS cost, COUNT(*) AS fills
       FROM fuel_transactions
      WHERE tenant_id = :tenantId AND status = 'active'${siteClause('site_id')}`,
    replacements
  );

  const [collected] = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS litres, COALESCE(SUM(amount), 0) AS cost
       FROM fuel_collections
      WHERE tenant_id = :tenantId AND status <> 'cancelled'${siteClause('site_id')}`,
    replacements
  );
  const [direct] = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS litres, COALESCE(SUM(amount), 0) AS cost
       FROM fuel_transactions
      WHERE tenant_id = :tenantId AND status = 'active' AND source = 'DIRECT_PUMP'${siteClause('site_id')}`,
    replacements
  );

  const stock = await query(
    `SELECT fuel_type AS fuelType, COALESCE(SUM(quantity_on_hand), 0) AS litres, COALESCE(SUM(stock_value), 0) AS value
       FROM site_fuel_stocks
      WHERE tenant_id = :tenantId${siteClause('site_id')}
      GROUP BY fuel_type
      ORDER BY fuel_type`,
    replacements
  );

  return {
    used: { litres: roundQuantity(num(used.litres)), cost: roundMoney(num(used.cost)), fills: num(used.fills) },
    bought: {
      litres: roundQuantity(num(collected.litres) + num(direct.litres)),
      cost: roundMoney(num(collected.cost) + num(direct.cost)),
    },
    siteStock: stock.map((s) => ({ fuelType: s.fuelType, litres: roundQuantity(num(s.litres)), value: roundMoney(num(s.value)) })),
  };
}

async function inventorySummary(tenantId, siteClause, replacements) {
  const [totals] = await query(
    `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'ISSUE' THEN total_cost
                              WHEN transaction_type = 'ISSUE_REVERSAL' THEN -total_cost ELSE 0 END), 0) AS partsUsed,
            COALESCE(SUM(CASE WHEN transaction_type = 'PURCHASE_RECEIPT' THEN total_cost ELSE 0 END), 0) AS purchased
       FROM inventory_transactions
      WHERE tenant_id = :tenantId AND status = 'posted'${siteClause('site_id')}`,
    replacements
  );

  const [issues] = await query(
    `SELECT COUNT(*) AS total FROM asset_issues WHERE tenant_id = :tenantId${siteClause('site_id')}`,
    replacements
  );

  const [value] = await query(
    `SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0) AS value
       FROM stock_batches
      WHERE tenant_id = :tenantId AND remaining_quantity > 0${siteClause('site_id')}`,
    replacements
  );

  return {
    partsUsedCost: roundMoney(num(totals.partsUsed)),
    purchasesReceived: roundMoney(num(totals.purchased)),
    issues: num(issues.total),
    stockValue: roundMoney(num(value.value)),
  };
}

async function monthlyTrend(tenantId, siteClause, replacements, now) {
  const first = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1), 1);
  const months = Array.from({ length: TREND_MONTHS }, (_, i) => monthKey(new Date(first.getFullYear(), first.getMonth() + i, 1)));
  const offsetMinutes = -now.getTimezoneOffset();
  const dateRange = { ...replacements, fromDate: dateOnly(first), today: dateOnly(now) };
  const timeRange = { ...replacements, offsetMinutes, fromAt: first, nowAt: now };
  const localMonth = (column) => `DATE_FORMAT(DATE_ADD(${column}, INTERVAL :offsetMinutes MINUTE), '%Y-%m')`;

  const [fuelUsed, fuelBought, inventory, issues] = await Promise.all([
    query(
      `SELECT DATE_FORMAT(txn_date, '%Y-%m') AS month,
              COALESCE(SUM(amount), 0) AS cost, COALESCE(SUM(quantity), 0) AS litres, COUNT(*) AS fills,
              COALESCE(SUM(CASE WHEN source = 'DIRECT_PUMP' THEN amount ELSE 0 END), 0) AS directCost,
              COALESCE(SUM(CASE WHEN source = 'DIRECT_PUMP' THEN quantity ELSE 0 END), 0) AS directLitres
         FROM fuel_transactions
        WHERE tenant_id = :tenantId AND status = 'active' AND txn_date >= :fromDate AND txn_date <= :today${siteClause('site_id')}
        GROUP BY month`,
      dateRange
    ),
    query(
      `SELECT DATE_FORMAT(collection_date, '%Y-%m') AS month, COALESCE(SUM(amount), 0) AS cost, COALESCE(SUM(quantity), 0) AS litres
         FROM fuel_collections
        WHERE tenant_id = :tenantId AND status <> 'cancelled' AND collection_date >= :fromDate AND collection_date <= :today${siteClause('site_id')}
        GROUP BY month`,
      dateRange
    ),
    query(
      `SELECT ${localMonth('transaction_at')} AS month,
              COALESCE(SUM(CASE WHEN transaction_type = 'ISSUE' THEN total_cost
                                WHEN transaction_type = 'ISSUE_REVERSAL' THEN -total_cost ELSE 0 END), 0) AS parts,
              COALESCE(SUM(CASE WHEN transaction_type = 'PURCHASE_RECEIPT' THEN total_cost ELSE 0 END), 0) AS purchases
         FROM inventory_transactions
        WHERE tenant_id = :tenantId AND status = 'posted' AND transaction_type IN ('ISSUE', 'ISSUE_REVERSAL', 'PURCHASE_RECEIPT')
          AND transaction_at >= :fromAt AND transaction_at <= :nowAt${siteClause('site_id')}
        GROUP BY month`,
      timeRange
    ),
    query(
      `SELECT ${localMonth('issue_date_time')} AS month, COUNT(*) AS total
         FROM asset_issues
        WHERE tenant_id = :tenantId AND issue_date_time >= :fromAt AND issue_date_time <= :nowAt${siteClause('site_id')}
        GROUP BY month`,
      timeRange
    ),
  ]);

  const byMonth = (rows) => new Map(rows.map((r) => [r.month, r]));
  const used = byMonth(fuelUsed);
  const bought = byMonth(fuelBought);
  const stock = byMonth(inventory);
  const issued = byMonth(issues);

  return months.map((month) => {
    const u = used.get(month) ?? {};
    const b = bought.get(month) ?? {};
    const i = stock.get(month) ?? {};
    const fuel = roundMoney(num(u.cost));
    const parts = roundMoney(num(i.parts));
    return {
      month,
      fuel,
      parts,
      total: roundMoney(fuel + parts),
      fuelLitres: roundQuantity(num(u.litres)),
      fills: num(u.fills),
      issues: num(issued.get(month)?.total),
      purchases: roundMoney(num(i.purchases)),
      fuelBought: roundMoney(num(b.cost) + num(u.directCost)),
      fuelBoughtLitres: roundQuantity(num(b.litres) + num(u.directLitres)),
    };
  });
}

async function getSummary({ tenantId, auth }) {
  const siteId = supervisorSiteId(auth);
  const replacements = { tenantId, siteId };
  const siteClause = (column) => (siteId ? ` AND ${column} = :siteId` : '');
  const showCosts = hasPermission(auth.role, 'DASHBOARD', 'VIEW_COST_METRICS');

  const now = new Date();
  const today = todayDateOnly();

  const [fleet, fuel, inventory, trend] = await Promise.all([
    fleetSummary(tenantId, siteClause, replacements),
    fuelSummary(tenantId, siteClause, replacements),
    inventorySummary(tenantId, siteClause, replacements),
    showCosts ? monthlyTrend(tenantId, siteClause, replacements, now) : null,
  ]);

  if (!showCosts) {
    delete fuel.used.cost;
    delete fuel.bought.cost;
    fuel.siteStock = fuel.siteStock.map(({ value, ...rest }) => rest);
    delete inventory.partsUsedCost;
    delete inventory.purchasesReceived;
    delete inventory.stockValue;
  }

  return {
    generatedAt: now.toISOString(),
    period: { today },
    scope: { siteId },
    showCosts,
    fleet,
    fuel,
    inventory,
    monthly: showCosts ? trend : null,
  };
}

module.exports = { getSummary };
