
const ROLES = Object.freeze({
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
});

const BOTH = [ROLES.ADMIN, ROLES.SUPERVISOR];
const ADMIN_ONLY = [ROLES.ADMIN];

const standardModule = Object.freeze({
  CREATE: BOTH,
  READ: BOTH,
  UPDATE: BOTH,
  DELETE: ADMIN_ONLY,
  RESTORE: ADMIN_ONLY,
});

const PERMISSIONS = Object.freeze({
  VEHICLE: standardModule,
  MACHINERY: standardModule,
  MAINTENANCE: standardModule,
  SERVICE: standardModule,
  TYRE: standardModule,
  FUEL: standardModule,
  COMPLIANCE: standardModule,

  // The Sites module belongs to the Admin. A Supervisor is tied to one site, so a
  // site they created would be invisible the moment it existed, and a site they
  // renamed or archived is one the Admin assigned them to — not theirs to change.
  //
  // READ stays open to both: a Supervisor still needs the name of their own site
  // on an asset page and in the asset form. services/siteAccess.js already limits
  // those reads to that one site, so READ never exposes another site.
  //
  // ASSIGN = moving a vehicle or machine from one site to another. Admin only:
  // a Supervisor belongs to a single site and must not move assets out of it.
  SITE: Object.freeze({
    ...standardModule,
    CREATE: ADMIN_ONLY,
    UPDATE: ADMIN_ONLY,
    ASSIGN: ADMIN_ONLY,
  }),

  DOCUMENT: Object.freeze({
    CREATE: BOTH,
    READ: BOTH,
  }),

  REPORTS: Object.freeze({
    VIEW: BOTH,
    PRINT: BOTH,
    EXPORT: ADMIN_ONLY,
  }),

  USERS: Object.freeze({
    LIST: ADMIN_ONLY,
    CREATE_SUPERVISOR: ADMIN_ONLY,
    UPDATE_SUPERVISOR: ADMIN_ONLY,
    SET_SUPERVISOR_STATUS: ADMIN_ONLY,
    VIEW_OWN_PROFILE: BOTH,
  }),

  DASHBOARD: Object.freeze({
    VIEW: BOTH,
    VIEW_SUMMARY_METRICS: BOTH,
    VIEW_COST_METRICS: ADMIN_ONLY,
  }),
});

function hasPermission(role, resource, action) {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

module.exports = { ROLES, PERMISSIONS, hasPermission };
