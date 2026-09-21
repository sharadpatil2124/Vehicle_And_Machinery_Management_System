const { SiteAssignment, Site, User } = require('../models');
const { resolveAsset } = require('./asset.service');

function toPublic(assignment) {
  return assignment.toPublicJSON();
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

  if (previousSiteId != null) {
    await SiteAssignment.update(
      { unassignedAt: new Date() },
      { where: { tenantId, assetType, assetId, siteId: previousSiteId, unassignedAt: null }, transaction }
    );
  }

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
}

async function listSiteHistory({ tenantId, auth, assetType, assetId }) {
  await resolveAsset(tenantId, assetType, assetId, { auth });

  const assignments = await SiteAssignment.findAll({
    where: { tenantId, assetType, assetId },
    include: [
      { model: Site, as: 'site', attributes: ['id', 'name', 'location'] },
      { model: User, as: 'assigner', attributes: ['id', 'name'] },
    ],
    order: [['assignedAt', 'DESC']],
  });

  return assignments.map(toPublic);
}

module.exports = { recordSiteAssignment, listSiteHistory };
