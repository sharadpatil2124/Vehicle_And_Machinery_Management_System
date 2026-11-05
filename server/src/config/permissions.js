
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
  // Correcting a saved cost is the Admin's. A Supervisor enters it once, when finishing the work.
  MAINTENANCE: Object.freeze({ ...standardModule, UPDATE_COST: ADMIN_ONLY }),
  SERVICE: standardModule,
  TYRE: standardModule,
  FUEL: standardModule,
  ADBLUE: standardModule,
  COMPLIANCE: standardModule,

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

  ITEM_CATEGORY: Object.freeze({ ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY }),
  UOM: Object.freeze({ ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY }),
  ITEM: Object.freeze({ ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY }),
  SUPPLIER: Object.freeze({ ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY }),

  PURCHASE: Object.freeze({ CREATE: BOTH, READ: BOTH, UPDATE: BOTH, RECEIVE: BOTH }),

  STOCK: Object.freeze({ READ: BOTH }),

  ASSET_ISSUE: Object.freeze({ CREATE: BOTH, READ: BOTH, REVERSE: BOTH }),

  STOCK_ADJUSTMENT: Object.freeze({ CREATE: BOTH, READ: BOTH }),
  STOCK_TRANSFER: Object.freeze({ CREATE: ADMIN_ONLY, READ: ADMIN_ONLY, RECEIVE: ADMIN_ONLY }),

  FUEL_STATION: Object.freeze({ ...standardModule, CREATE: ADMIN_ONLY, UPDATE: ADMIN_ONLY }),
  FUEL_COLLECTION: Object.freeze({ CREATE: BOTH, READ: BOTH, UPDATE: BOTH, RECEIVE: BOTH, CANCEL: ADMIN_ONLY }),
  FUEL_STOCK: Object.freeze({ READ: BOTH }),

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
    CHANGE_SUPERVISOR_PASSWORD: ADMIN_ONLY,
    VIEW_OWN_PROFILE: BOTH,
    UPDATE_OWN_PROFILE: ADMIN_ONLY,
    CHANGE_OWN_PASSWORD: ADMIN_ONLY,
  }),

  DASHBOARD: Object.freeze({
    VIEW: BOTH,
    VIEW_SUMMARY_METRICS: BOTH,
  }),

  BRANDING: Object.freeze({
    READ: BOTH,
    UPDATE: ADMIN_ONLY,
  }),
});

function hasPermission(role, resource, action) {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

module.exports = { ROLES, PERMISSIONS, hasPermission };
