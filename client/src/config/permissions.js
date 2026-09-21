export const ROLES = Object.freeze({
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
});

const BOTH = [ROLES.ADMIN, ROLES.SUPERVISOR];
const ADMIN_ONLY = [ROLES.ADMIN];

const standardModule = { CREATE: BOTH, READ: BOTH, UPDATE: BOTH, DELETE: ADMIN_ONLY, RESTORE: ADMIN_ONLY };

export const PERMISSIONS = Object.freeze({
  VEHICLE: standardModule,
  MACHINERY: standardModule,
  MAINTENANCE: standardModule,
  SERVICE: standardModule,
  TYRE: standardModule,
  FUEL: standardModule,
  COMPLIANCE: standardModule,
  // Mirrors server/src/config/permissions.js — the Sites module is Admin-only.
  // READ stays open to both so a Supervisor can still see the name of their own
  // site; the server limits that read to the one site assigned to them.
  SITE: { ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY, ASSIGN: ADMIN_ONLY },
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
