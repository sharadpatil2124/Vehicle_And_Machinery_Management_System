const siteService = require('../services/site.service');

async function list(req, res) {
  const response = await siteService.listSites({ tenantId: req.auth.tenantId, query: req.query });
  res.status(200).json({ ...response, message: 'Sites retrieved' });
}

async function get(req, res) {
  const data = await siteService.getSite({ tenantId: req.auth.tenantId, id: req.params.id });
  res.status(200).json({ data, message: 'Site retrieved' });
}

async function create(req, res) {
  const data = await siteService.createSite({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    payload: req.body ?? {},
  });
  res.status(201).json({ data, message: 'Site created' });
}

async function update(req, res) {
  const data = await siteService.updateSite({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    payload: req.body ?? {},
  });
  res.status(200).json({ data, message: 'Site updated' });
}

async function remove(req, res) {
  const data = await siteService.deleteSite({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    id: req.params.id,
    confirmation: req.body?.confirmation,
  });
  res.status(200).json({ data, message: 'Site archived successfully' });
}

module.exports = { list, get, create, update, remove };
