export const ROLES = Object.freeze({
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
});

const BOTH = [ROLES.ADMIN, ROLES.SUPERVISOR];
const ADMIN_ONLY = [ROLES.ADMIN];

const standardModule = { CREATE: BOTH, READ: BOTH, UPDATE: BOTH, DELETE: ADMIN_ONLY };

export const PERMISSIONS = Object.freeze({
  VEHICLE: standardModule,
  MACHINERY: standardModule,
  MAINTENANCE: standardModule,
  SERVICE: standardModule,
  TYRE: standardModule,
  FUEL: standardModule,
  COMPLIANCE: standardModule,
  SITE: { ...standardModule, ASSIGN: BOTH },
  DOCUMENT: { CREATE: BOTH, READ: BOTH },
  REPORTS: { VIEW: BOTH, PRINT: BOTH, EXPORT: ADMIN_ONLY },
  USERS: {
    LIST: ADMIN_ONLY,
    CREATE_SUPERVISOR: ADMIN_ONLY,
    UPDATE_SUPERVISOR: ADMIN_ONLY,
    SET_SUPERVISOR_STATUS: ADMIN_ONLY,
    VIEW_OWN_PROFILE: BOTH,
  },
  DASHBOARD: { VIEW: BOTH, VIEW_SUMMARY_METRICS: BOTH, VIEW_COST_METRICS: ADMIN_ONLY },
});

export function hasPermission(role, resource, action) {
  const allowed = PERMISSIONS[resource]?.[action];
  return Array.isArray(allowed) && allowed.includes(role);
}
