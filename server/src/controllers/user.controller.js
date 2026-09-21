const userService = require('../services/user.service');

async function list(req, res) {
  const data = await userService.listOrganizationUsers({ tenantId: req.auth.tenantId });
  res.status(200).json({ data, message: 'Users retrieved' });
}

async function createSupervisor(req, res) {
  const { name, email, siteId } = req.body ?? {};

  const data = await userService.createSupervisor({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    name,
    email,
    siteId,
  });

  res.status(201).json({ data, message: 'Supervisor created' });
}

async function updateSupervisor(req, res) {
  const { name, email, siteId } = req.body ?? {};

  const data = await userService.updateSupervisor({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    supervisorId: req.params.id,
    name,
    email,
    siteId,
  });

  res.status(200).json({ data, message: 'Supervisor updated' });
}

async function setSupervisorStatus(req, res) {
  const { status } = req.body ?? {};

  const data = await userService.setSupervisorStatus({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    supervisorId: req.params.id,
    status,
  });

  res.status(200).json({ data, message: `Supervisor ${status === 'active' ? 'reactivated' : 'deactivated'}` });
}

module.exports = { list, createSupervisor, updateSupervisor, setSupervisorStatus };
