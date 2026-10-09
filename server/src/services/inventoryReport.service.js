const { QueryTypes } = require('sequelize');

const { sequelize, Vehicle, Machinery } = require('../models');
const AppError = require('../utils/AppError');
const { supervisorSiteId } = require('./siteAccess');
const { roundQuantity, roundMoney, todayDateOnly, optionalDateFilter } = require('./fuelCommon');

function readRange(query) {
  const today = todayDateOnly();
  const dateFrom = optionalDateFilter(query.dateFrom, 'From date') ?? `${today.slice(0, 8)}01`;
  const dateTo = optionalDateFilter(query.dateTo, 'To date') ?? today;
  if (dateFrom > dateTo) throw AppError.badRequest('From date must be on or before To date');

  const [fy, fm, fd] = dateFrom.split('-').map(Number);
  const [ty, tm, td] = dateTo.split('-').map(Number);
  return { dateFrom, dateTo, fromAt: new Date(fy, fm - 1, fd), toAt: new Date(ty, tm - 1, td + 1) };
}

function siteFilter(auth, query) {
  const ownSiteId = supervisorSiteId(auth);
  if (ownSiteId !== null) return ownSiteId;
  return query.siteId ? Number(query.siteId) : null;
}

function select(sql, replacements) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

const num = (value) => (value == null ? 0 : Number(value));
const amount = (quantity, value) => ({ quantity: roundQuantity(num(quantity)), value: roundMoney(num(value)) });

const SIGNED = `CASE t.transaction_type
                  WHEN 'ISSUE' THEN -1
                  WHEN 'TRANSFER_OUT' THEN -1
                  WHEN 'ADJUSTMENT' THEN SIGN(sai.adjustment_quantity)
                  ELSE 1
                END`;

async function stockRegister({ tenantId, auth, query }) {
  const { dateFrom, dateTo, fromAt, toAt } = readRange(query);
  const siteId = siteFilter(auth, query);

  const inRange = 't.transaction_at >= :fromAt';
  const rows = await select(
    `SELECT t.item_id AS itemId, i.item_code AS itemCode, i.item_name AS itemName, u.uom_name AS uom,
            SUM(CASE WHEN t.transaction_at < :fromAt THEN ${SIGNED} * t.quantity ELSE 0 END) AS openingQty,
            SUM(CASE WHEN t.transaction_at < :fromAt THEN ${SIGNED} * t.total_cost ELSE 0 END) AS openingValue,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'PURCHASE_RECEIPT' THEN t.quantity ELSE 0 END) AS purchasedQty,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'PURCHASE_RECEIPT' THEN t.total_cost ELSE 0 END) AS purchasedValue,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'ISSUE' THEN t.quantity
                     WHEN ${inRange} AND t.transaction_type = 'ISSUE_REVERSAL' THEN -t.quantity ELSE 0 END) AS usedQty,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'ISSUE' THEN t.total_cost
                     WHEN ${inRange} AND t.transaction_type = 'ISSUE_REVERSAL' THEN -t.total_cost ELSE 0 END) AS usedValue,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'ADJUSTMENT' THEN ${SIGNED} * t.quantity ELSE 0 END) AS adjustedQty,
            SUM(CASE WHEN ${inRange} AND t.transaction_type = 'ADJUSTMENT' THEN ${SIGNED} * t.total_cost ELSE 0 END) AS adjustedValue,
            SUM(CASE WHEN ${inRange} AND t.transaction_type IN ('TRANSFER_IN', 'TRANSFER_OUT') THEN ${SIGNED} * t.quantity ELSE 0 END) AS transferQty,
            SUM(CASE WHEN ${inRange} AND t.transaction_type IN ('TRANSFER_IN', 'TRANSFER_OUT') THEN ${SIGNED} * t.total_cost ELSE 0 END) AS transferValue
       FROM inventory_transactions t
       JOIN items i ON i.id = t.item_id
       LEFT JOIN units_of_measure u ON u.id = i.base_uom_id
       LEFT JOIN stock_adjustment_items sai ON t.transaction_type = 'ADJUSTMENT' AND t.reference_type = 'STOCK_ADJUSTMENT_ITEM' AND sai.id = t.reference_id
      WHERE t.tenant_id = :tenantId AND t.status = 'posted' AND t.transaction_at < :toAt${siteId ? ' AND t.site_id = :siteId' : ''}
      GROUP BY t.item_id, i.item_code, i.item_name, u.uom_code`,
    { tenantId, siteId, fromAt, toAt }
  );

  const data = rows
    .map((r) => {
      const row = {
        itemId: r.itemId,
        itemCode: r.itemCode,
        itemName: r.itemName,
        uom: r.uom,
        opening: amount(r.openingQty, r.openingValue),
        purchased: amount(r.purchasedQty, r.purchasedValue),
        used: amount(r.usedQty, r.usedValue),
        adjusted: amount(r.adjustedQty, r.adjustedValue),
        transfers: amount(r.transferQty, r.transferValue),
      };
      row.closing = {
        quantity: roundQuantity(
          row.opening.quantity + row.purchased.quantity - row.used.quantity + row.adjusted.quantity + row.transfers.quantity
        ),
        value: roundMoney(row.opening.value + row.purchased.value - row.used.value + row.adjusted.value + row.transfers.value),
      };
      row.closingUnitCost = row.closing.quantity > 0 ? roundMoney(row.closing.value / row.closing.quantity) : null;
      return row;
    })
    .filter((r) => ['opening', 'purchased', 'used', 'adjusted', 'transfers', 'closing'].some((k) => r[k].quantity !== 0 || r[k].value !== 0))
    .sort((a, b) => b.closing.value - a.closing.value || String(a.itemName).localeCompare(String(b.itemName)));

  const total = (key) => roundMoney(data.reduce((sum, r) => sum + r[key].value, 0));
  return {
    dateFrom,
    dateTo,
    totals: {
      opening: total('opening'),
      purchased: total('purchased'),
      used: total('used'),
      adjusted: total('adjusted'),
      transfers: total('transfers'),
      closing: total('closing'),
    },
    rows: data,
  };
}

function blankPurchaseGroup(key, label, extra = {}) {
  return { key, label, purchaseIds: new Set(), quantity: 0, beforeTax: 0, tax: 0, total: 0, low: null, high: null, ...extra };
}

function finishPurchaseGroup({ purchaseIds, ...g }) {
  return {
    ...g,
    purchases: purchaseIds.size,
    quantity: roundQuantity(g.quantity),
    beforeTax: roundMoney(g.beforeTax),
    tax: roundMoney(g.tax),
    total: roundMoney(g.total),
    averageUnitCost: g.quantity > 0 ? roundMoney(g.total / g.quantity) : null,
  };
}

async function purchases({ tenantId, auth, query }) {
  const { dateFrom, dateTo, fromAt, toAt } = readRange(query);
  const siteId = siteFilter(auth, query);

  const lines = await select(
    `SELECT p.id AS purchaseId, p.supplier_id AS supplierId, s.supplier_name AS supplierName,
            t.item_id AS itemId, i.item_code AS itemCode, i.item_name AS itemName, u.uom_name AS uom,
            t.quantity AS quantity, t.unit_cost AS unitCost, t.total_cost AS totalCost, pi.unit_price AS unitPrice
       FROM inventory_transactions t
       JOIN purchase_items pi ON pi.id = t.reference_id
       JOIN purchases p ON p.id = pi.purchase_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       JOIN items i ON i.id = t.item_id
       LEFT JOIN units_of_measure u ON u.id = i.base_uom_id
      WHERE t.tenant_id = :tenantId AND t.status = 'posted'
        AND t.transaction_type = 'PURCHASE_RECEIPT' AND t.reference_type = 'PURCHASE_ITEM'
        AND t.transaction_at >= :fromAt AND t.transaction_at < :toAt${siteId ? ' AND t.site_id = :siteId' : ''}`,
    { tenantId, siteId, fromAt, toAt }
  );

  const bySupplier = new Map();
  const byItem = new Map();
  const all = blankPurchaseGroup('all', 'All');

  for (const line of lines) {
    const quantity = num(line.quantity);
    const total = num(line.totalCost);
    const beforeTax = roundMoney(num(line.unitPrice) * quantity);
    const tax = roundMoney(total - beforeTax);
    const unitCost = num(line.unitCost);

    const supplierKey = line.supplierId ?? 'none';
    if (!bySupplier.has(supplierKey)) bySupplier.set(supplierKey, blankPurchaseGroup(supplierKey, line.supplierName ?? 'No supplier'));
    if (!byItem.has(line.itemId)) {
      byItem.set(line.itemId, blankPurchaseGroup(line.itemId, line.itemName, { itemCode: line.itemCode, uom: line.uom }));
    }

    for (const g of [bySupplier.get(supplierKey), byItem.get(line.itemId), all]) {
      g.purchaseIds.add(line.purchaseId);
      g.quantity += quantity;
      g.beforeTax += beforeTax;
      g.tax += tax;
      g.total += total;
      g.low = g.low === null ? unitCost : Math.min(g.low, unitCost);
      g.high = g.high === null ? unitCost : Math.max(g.high, unitCost);
    }
  }

  const sortByTotal = (a, b) => b.total - a.total;
  const totals = finishPurchaseGroup(all);
  return {
    dateFrom,
    dateTo,
    totals: { purchases: totals.purchases, lines: lines.length, beforeTax: totals.beforeTax, tax: totals.tax, total: totals.total },
    bySupplier: [...bySupplier.values()].map(finishPurchaseGroup).map(({ quantity, averageUnitCost, low, high, ...g }) => g).sort(sortByTotal),
    byItem: [...byItem.values()].map(finishPurchaseGroup).sort(sortByTotal),
  };
}

async function partsByAsset({ tenantId, auth, query }) {
  const { dateFrom, dateTo, fromAt, toAt } = readRange(query);
  const siteId = siteFilter(auth, query);

  const movements = await select(
    `SELECT ai.id AS issueId, ai.asset_type AS assetType, ai.asset_id AS assetId,
            t.transaction_type AS type, t.quantity AS quantity, t.total_cost AS totalCost
       FROM inventory_transactions t
       LEFT JOIN asset_issue_items aii
              ON t.transaction_type = 'ISSUE' AND t.reference_type = 'ASSET_ISSUE_ITEM' AND aii.id = t.reference_id
       LEFT JOIN issue_reversal_items iri
              ON t.transaction_type = 'ISSUE_REVERSAL' AND t.reference_type = 'ISSUE_REVERSAL_ITEM' AND iri.id = t.reference_id
       LEFT JOIN asset_issue_items original ON original.id = iri.asset_issue_item_id
       JOIN asset_issues ai ON ai.id = COALESCE(aii.asset_issue_id, original.asset_issue_id)
      WHERE t.tenant_id = :tenantId AND t.status = 'posted' AND t.transaction_type IN ('ISSUE', 'ISSUE_REVERSAL')
        AND t.transaction_at >= :fromAt AND t.transaction_at < :toAt${siteId ? ' AND t.site_id = :siteId' : ''}`,
    { tenantId, siteId, fromAt, toAt }
  );

  const groups = new Map();
  for (const m of movements) {
    const key = `${m.assetType}:${m.assetId}`;
    if (!groups.has(key)) {
      groups.set(key, { assetType: m.assetType, assetId: m.assetId, issueIds: new Set(), issuedValue: 0, returnedValue: 0 });
    }
    const g = groups.get(key);
    if (m.type === 'ISSUE') {
      g.issueIds.add(m.issueId);
      g.issuedValue += num(m.totalCost);
    } else {
      g.returnedValue += num(m.totalCost);
    }
  }

  const vehicleIds = [...groups.values()].filter((g) => g.assetType === 'VEHICLE').map((g) => g.assetId);
  const machineIds = [...groups.values()].filter((g) => g.assetType === 'MACHINERY').map((g) => g.assetId);
  const [vehicles, machines] = await Promise.all([
    vehicleIds.length ? Vehicle.findAll({ where: { tenantId, assetId: vehicleIds }, attributes: ['id', 'assetId', 'registrationNumber'] }) : [],
    machineIds.length
      ? Machinery.findAll({ where: { tenantId, assetId: machineIds }, attributes: ['id', 'assetId', 'name', 'registrationNumber', 'serialNumber'] })
      : [],
  ]);
  const labels = new Map();
  for (const v of vehicles) labels.set(`VEHICLE:${v.assetId}`, { label: v.registrationNumber, recordId: v.id });
  for (const m of machines) {
    labels.set(`MACHINERY:${m.assetId}`, { label: m.name || m.registrationNumber || m.serialNumber || m.assetId, recordId: m.id });
  }

  const rows = [...groups.values()]
    .map(({ issueIds, ...g }) => {
      const found = labels.get(`${g.assetType}:${g.assetId}`);
      return {
        ...g,
        assetLabel: found?.label ?? null,
        assetRecordId: found?.recordId ?? null,
        issues: issueIds.size,
        issuedValue: roundMoney(g.issuedValue),
        returnedValue: roundMoney(g.returnedValue),
        netCost: roundMoney(g.issuedValue - g.returnedValue),
      };
    })
    .sort((a, b) => b.netCost - a.netCost);

  const sum = (key) => roundMoney(rows.reduce((t, r) => t + r[key], 0));
  return {
    dateFrom,
    dateTo,
    totals: { assets: rows.length, issues: rows.reduce((t, r) => t + r.issues, 0), issuedValue: sum('issuedValue'), returnedValue: sum('returnedValue'), netCost: sum('netCost') },
    rows,
  };
}

module.exports = { stockRegister, purchases, partsByAsset };
