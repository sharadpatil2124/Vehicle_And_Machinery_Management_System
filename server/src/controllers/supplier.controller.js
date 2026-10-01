const supplierService = require('../services/supplier.service');

async function list(req, res) {
  const response = await supplierService.listSuppliers({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Suppliers retrieved' });
}

async function get(req, res) {
  const data = await supplierService.getSupplier({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Supplier retrieved' });
}

async function create(req, res) {
  const data = await supplierService.createSupplier({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Supplier created' });
}

async function update(req, res) {
  const data = await supplierService.updateSupplier({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Supplier updated' });
}

async function remove(req, res) {
  const data = await supplierService.deleteSupplier({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Supplier archived successfully' });
}

async function restore(req, res) {
  const data = await supplierService.restoreSupplier({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
  });
  res.status(200).json({ data, message: 'Supplier restored successfully' });
}

module.exports = { list, get, create, update, remove, restore };
