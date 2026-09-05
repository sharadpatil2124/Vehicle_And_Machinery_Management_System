
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
});

const PERMISSIONS = Object.freeze({
  VEHICLE: standardModule,
  MACHINERY: standardModule,
  MAINTENANCE: standardModule,
  SERVICE: standardModule,
  TYRE: standardModule,
  FUEL: standardModule,
  COMPLIANCE: standardModule,

  SITE: Object.freeze({ ...standardModule, ASSIGN: BOTH }),

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
