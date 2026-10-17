const { Op, fn, col } = require('sequelize');

const { TyreStock, TyreType, TyreFitment } = require('../models');
const { roundMoney, siteNamesById } = require('./fuelCommon');
const { siteFilter } = require('./tyreCommon');

async function listTyreStock({ tenantId, auth, query }) {
  const where = { tenantId };
  const siteId = siteFilter(auth, query);
  if (siteId) where.siteId = siteId;

  const typeWhere = { tenantId };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    typeWhere[Op.or] = [{ brand: like }, { pattern: like }, { size: like }, { typeCode: like }];
  }

  const [stocks, fitted] = await Promise.all([
    TyreStock.findAll({ where, include: [{ model: TyreType, as: 'tyreType', where: typeWhere }] }),
    TyreFitment.findAll({
      where: { tenantId, removedAt: null, ...(siteId ? { siteId } : {}) },
      attributes: ['siteId', 'tyreTypeId', [fn('COUNT', col('id')), 'count']],
      group: ['siteId', 'tyreTypeId'],
      raw: true,
    }),
  ]);

  const fittedCount = new Map(fitted.map((f) => [`${f.siteId}:${f.tyreTypeId}`, Number(f.count)]));
  const siteNames = await siteNamesById(tenantId, stocks.map((s) => s.siteId));

  const rows = stocks
    .map((s) => ({
      ...s.toPublicJSON(),
      siteName: siteNames.get(s.siteId) ?? null,
      tyreTypeLabel: s.tyreType.label,
      tyreSize: s.tyreType.size,
      tyreTypeCode: s.tyreType.typeCode,
      fittedNow: fittedCount.get(`${s.siteId}:${s.tyreTypeId}`) ?? 0,
    }))
    .filter((r) => r.newQuantity > 0 || r.usedQuantity > 0 || r.fittedNow > 0)
    .sort((a, b) => a.tyreTypeLabel.localeCompare(b.tyreTypeLabel) || a.tyreSize.localeCompare(b.tyreSize) || String(a.siteName).localeCompare(String(b.siteName)));

  return {
    rows,
    totals: {
      newQuantity: rows.reduce((t, r) => t + r.newQuantity, 0),
      usedQuantity: rows.reduce((t, r) => t + r.usedQuantity, 0),
      fittedNow: rows.reduce((t, r) => t + r.fittedNow, 0),
      stockValue: roundMoney(rows.reduce((t, r) => t + r.stockValue, 0)),
    },
  };
}

module.exports = { listTyreStock };
