const { ROLES } = require('../config/permissions');
const AppError = require('../utils/AppError');

/**
 * Site-level access control — the whole rule lives in this one file.
 *
 *   Admin      → sees every site in the organization. No restriction.
 *   Supervisor → is assigned exactly one site and may only touch that site's data.
 *
 * Every place that reads or writes site-related data calls one of the two
 * helpers below, so there is only one definition of "what may this user see".
 */

const NO_SITE_ASSIGNED =
  'No site has been assigned to your account yet. Ask your Admin to assign one.';

/**
 * The one site this user is limited to, or `null` when the user is an Admin
 * (meaning: no limit). Throws if a Supervisor has no site yet, because such an
 * account must not fall back to seeing everything.
 */
function supervisorSiteId(auth) {
  if (!auth || auth.role !== ROLES.SUPERVISOR) return null;
  if (!auth.siteId) throw AppError.forbidden(NO_SITE_ASSIGNED);
  return auth.siteId;
}

/**
 * Adds the Supervisor's site to a list query's `where`. Returns `where`
 * unchanged for an Admin.
 *
 *   const where = scopeToSite({ status: 'active' }, auth, 'currentSiteId');
 */
function scopeToSite(where, auth, column = 'currentSiteId') {
  const siteId = supervisorSiteId(auth);
  if (siteId === null) return where;
  return { ...where, [column]: siteId };
}

/**
 * Stops a Supervisor from touching a record that belongs to a different site
 * (or to no site at all). Does nothing for an Admin.
 *
 * It throws 404 rather than 403 on purpose: the same answer a record from
 * another organization gives, so a Supervisor cannot use the difference to
 * work out what exists at other sites.
 */
function assertSiteAllowed(auth, siteId, notFoundMessage = 'Not found') {
  const allowedSiteId = supervisorSiteId(auth);
  if (allowedSiteId === null) return;
  if (Number(siteId) !== Number(allowedSiteId)) {
    throw AppError.notFound(notFoundMessage);
  }
}

/**
 * Moving an asset from one site to another is an Admin action. A Supervisor may
 * edit an asset at their own site, but may not send it somewhere else.
 *
 * `siteInput` is the parsed `{ currentSiteId }` from the request, and it is
 * emptied when a Supervisor simply re-sends the site the asset is already at —
 * the edit form always posts every field, and that is not an attempt to move
 * anything.
 */
function assertSiteChangeAllowed(auth, currentSiteId, siteInput) {
  if (supervisorSiteId(auth) === null) return;
  if (!('currentSiteId' in siteInput)) return;

  if (Number(siteInput.currentSiteId) !== Number(currentSiteId)) {
    throw AppError.forbidden('Only an Admin can move an asset to a different site');
  }
  delete siteInput.currentSiteId;
}

module.exports = {
  supervisorSiteId,
  scopeToSite,
  assertSiteAllowed,
  assertSiteChangeAllowed,
  NO_SITE_ASSIGNED,
};
