const { ROLES } = require('../config/permissions');
const AppError = require('../utils/AppError');

const NO_SITE_ASSIGNED =
  'No site has been assigned to your account yet. Ask your Admin to assign one.';

function supervisorSiteId(auth) {
  if (!auth || auth.role !== ROLES.SUPERVISOR) return null;
  if (!auth.siteId) throw AppError.forbidden(NO_SITE_ASSIGNED);
  return auth.siteId;
}

function scopeToSite(where, auth, column = 'currentSiteId') {
  const siteId = supervisorSiteId(auth);
  if (siteId === null) return where;
  return { ...where, [column]: siteId };
}

function assertSiteAllowed(auth, siteId, notFoundMessage = 'Not found') {
  const allowedSiteId = supervisorSiteId(auth);
  if (allowedSiteId === null) return;
  if (Number(siteId) !== Number(allowedSiteId)) {
    throw AppError.notFound(notFoundMessage);
  }
}

function assertSiteChangeAllowed(auth, currentSiteId, siteInput) {
  if (supervisorSiteId(auth) === null) return;
  if (!('currentSiteId' in siteInput)) return;

  if (Number(siteInput.currentSiteId) !== Number(currentSiteId)) {
    throw AppError.forbidden('Only an Admin can move an asset to a different site');
  }
  delete siteInput.currentSiteId;
}

function assertEitherSiteAllowed(auth, siteIdA, siteIdB, notFoundMessage = 'Not found') {
  const allowedSiteId = supervisorSiteId(auth);
  if (allowedSiteId === null) return;
  if (Number(siteIdA) === Number(allowedSiteId) || Number(siteIdB) === Number(allowedSiteId)) return;
  throw AppError.notFound(notFoundMessage);
}

module.exports = {
  supervisorSiteId,
  scopeToSite,
  assertSiteAllowed,
  assertSiteChangeAllowed,
  assertEitherSiteAllowed,
  NO_SITE_ASSIGNED,
};
