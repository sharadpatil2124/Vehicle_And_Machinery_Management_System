const { Op } = require('sequelize');

const { Maintenance, SiteAssignment, Site, User } = require('../models');
const { resolveAsset } = require('./asset.service');
const { recordUpdate } = require('./audit.service');

function toPublic(assignment) {
  return assignment.toPublicJSON();
}

// Open jobs move with the asset, so its new site can see and finish them. Finished and deleted records stay where they are.
async function moveOpenMaintenance({ tenantId, assetType, assetId, nextSiteId, actingUserId, transaction }) {
  const openJobs = await Maintenance.findAll({
    where: { tenantId, assetType, assetId, status: 'active', stage: { [Op.ne]: 'resolved' } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const job of openJobs) {
    const before = job.toJSON();
    await job.update({ siteId: nextSiteId, updatedBy: actingUserId }, { transaction });
    await recordUpdate(
      { tenantId, entityType: 'Maintenance', entityId: job.id, performedBy: actingUserId, before, after: job },
      { transaction }
    );
  }
}

async function recordSiteAssignment({
  tenantId,
  assetType,
  assetId,
  previousSiteId,
  nextSiteId,
  actingUserId,
  transaction,
}) {
  if (previousSiteId === nextSiteId) return;

  // Close every open row of the asset, not only the previous site's, so it can never stay "current" at two sites.
  await SiteAssignment.update(
    { unassignedAt: new Date() },
    { where: { tenantId, assetType, assetId, unassignedAt: null }, transaction }
  );

  if (nextSiteId != null) {
    await SiteAssignment.create(
      {
        tenantId,
        assetType,
        assetId,
        siteId: nextSiteId,
        assignedAt: new Date(),
        assignedBy: actingUserId,
      },
      { transaction }
    );
  }

  await moveOpenMaintenance({ tenantId, assetType, assetId, nextSiteId, actingUserId, transaction });
}

async function listSiteHistory({ tenantId, auth, assetType, assetId }) {
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const assignments = await SiteAssignment.findAll({
    where: { tenantId, assetType, assetId },
    include: [
      { model: Site, as: 'site', attributes: ['id', 'name', 'location'] },
      { model: User, as: 'assigner', attributes: ['id', 'name'] },
    ],
    order: [['assignedAt', 'DESC'], ['id', 'DESC']],
  });

  return assignments.map(toPublic);
}

module.exports = { recordSiteAssignment, listSiteHistory };
