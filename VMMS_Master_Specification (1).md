# Vehicle & Machinery Management System (VMMS)
## Complete Master Specification — Multi-Tenant, Role-Based, Production-Ready

> **Purpose of this document:** This is the single, authoritative specification for building the Vehicle & Machinery Management System. It is written to be handed directly to an AI coding agent (Claude) as the primary source of truth. Build the system exactly as described. Where a detail is ambiguous, choose a sensible production-ready default, document the choice, and continue.

---

## Table of Contents

1. [Project Overview & Objectives](#1-project-overview--objectives)
2. [Non-Negotiable Domain Rule](#2-non-negotiable-domain-rule)
3. [Technology Stack](#3-technology-stack)
4. [Multi-Tenant Architecture](#4-multi-tenant-architecture)
5. [Organization / Tenant Structure](#5-organization--tenant-structure)
6. [Tenant ID Flow & Data Isolation](#6-tenant-id-flow--data-isolation)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Roles: Admin & Supervisor](#8-roles-admin--supervisor)
9. [Role-Based Permission Matrix](#9-role-based-permission-matrix)
10. [Login, Sign Up & Forgot Password](#10-login-sign-up--forgot-password)
11. [Asset Master (Common Concept)](#11-asset-master-common-concept)
12. [Vehicle Module](#12-vehicle-module)
13. [Machinery Module](#13-machinery-module)
14. [Asset Creation & Management](#14-asset-creation--management)
15. [Asset Deletion & DELETE-Word Verification](#15-asset-deletion--delete-word-verification)
16. [Maintenance Management](#16-maintenance-management)
17. [Record Service & Parts Consumed](#17-record-service--parts-consumed)
18. [Tyre Management](#18-tyre-management)
19. [Fuel Tracking & Cost Calculation](#19-fuel-tracking--cost-calculation)
20. [Compliance & Document Expiry](#20-compliance--document-expiry)
21. [Sites / Projects & Assignments](#21-sites--projects--assignments)
22. [Dashboard](#22-dashboard)
23. [Reports Hub & Printing Behavior](#23-reports-hub--printing-behavior)
24. [Database Structure & Relationships](#24-database-structure--relationships)
25. [API Structure & Workflow](#25-api-structure--workflow)
26. [Frontend Structure & UI/UX Requirements](#26-frontend-structure--uiux-requirements)
27. [Security Requirements](#27-security-requirements)
28. [Data Storage Requirements](#28-data-storage-requirements)
29. [Validation & Error Handling](#29-validation--error-handling)
30. [Production Coding Standards & Architecture](#30-production-coding-standards--architecture)
31. [Phase-Wise Development Plan](#31-phase-wise-development-plan)
32. [End-to-End Workflow](#32-end-to-end-workflow)
33. [Detailed User Flows](#33-detailed-user-flows)
34. [Admin vs Supervisor Access Summary](#34-admin-vs-supervisor-access-summary)
35. [Acceptance Criteria & Definition of Done](#35-acceptance-criteria--definition-of-done)
36. [Deliverables](#36-deliverables)
37. [Inventory & Stock Management Module](#37-inventory--stock-management-module) *(added)*

---

## 1. Project Overview & Objectives

**Project Name:** Vehicle & Machinery Management System (VMMS)

**Application Type:** Web-based, multi-tenant enterprise Admin Panel.

**Primary Users:** Organization Administrators and Supervisors.

**Summary:** VMMS replaces spreadsheet-based asset management with a centralized, multi-organization operational platform. Each organization (tenant) manages its own fleet of vehicles and machinery in complete data isolation. Within each organization, two roles — Admin and Supervisor — collaborate with distinct permission levels.

### Core Objectives

The system enables each organization to:

- Maintain an accurate asset master (vehicles and machinery).
- Track asset status and current/historical site assignments.
- Manage preventive maintenance and breakdown maintenance.
- Calculate vehicle service requirements using **KM**.
- Calculate machinery service requirements using **operating hours**.
- Record services, including labour and **parts consumed via manual text entry**.
- Manage tyres and their lifecycle.
- Track fuel transactions and calculate fuel cost, vehicle KM/Litre, and machinery cost/operating-hour.
- Manage insurance and compliance documents and detect expiring/expired documents.
- Track breakdown downtime.
- View operational dashboards, KPIs, and generate/print reports.
- Search, filter, sort, paginate, print, and export data.
- Preserve historical/audit information as a reliable operational source of truth.

### Key Questions the System Must Answer (per organization)

What assets do we have? Where are they deployed? What is their status? When is each vehicle/machine due for service? Which compliance documents are expired or expiring? What maintenance was performed and what parts/labour were used? How much fuel was consumed and what did it cost? How efficiently do vehicles consume fuel? What does machinery fuel cost per operating hour? What tyres are installed and how many KM have they run? Which assets are broken down and for how long? How much are we spending per asset/site/category?

---

## 2. Non-Negotiable Domain Rule

The single most important distinction in the entire system:

> **Vehicles = KM / Odometer based**
> **Machinery = Operating-hours based**

This distinction must consistently drive: preventive maintenance, fuel calculations, usage tracking, validation, dashboard KPIs, reports, and service-due logic.

**Never apply vehicle KM logic to machinery, and never apply machinery-hour logic to vehicles.** This rule is enforced in validation, business logic, and the data model.

---

## 3. Technology Stack

**Stack:** React + Node.js/Express + **MySQL** (relational).

| Layer | Technology |
|-------|-----------|
| Database | **MySQL 8+** (relational) |
| ORM / Query layer | **Prisma** (default) — Sequelize is an acceptable alternative; pick one and use it consistently |
| Migrations | ORM-managed schema migrations (Prisma Migrate / Sequelize migrations) |
| Backend | Node.js + Express.js |
| Frontend | React.js |
| Auth | JWT (access token), bcrypt for password hashing |
| Validation | Server-side (e.g. Joi/Zod/express-validator) + client-side |
| File storage | Local disk or S3-compatible (configurable via env) |
| Testing | Jest + Supertest (backend), React Testing Library (frontend) |
| Export | Excel (e.g. exceljs / SheetJS) and PDF (e.g. pdfkit / puppeteer) where configured |

**ORM choice:** This spec assumes **Prisma** with a MySQL datasource as the default (a single `schema.prisma` defining every model, with a generated, type-safe client and managed migrations). Sequelize (model classes per entity) is acceptable if preferred — but do not mix the two; choose one and apply it across every module. All code examples below are written against a Prisma-style client; translate faithfully if Sequelize is chosen.

**Environment:** All secrets and configuration via environment variables, including the MySQL connection string (`DATABASE_URL`). Ship a `.env.example`. Never commit secrets or hardcode credentials in source.

**Referential integrity:** Because MySQL is relational, use real foreign keys, `NOT NULL` constraints, appropriate column types (e.g. `DECIMAL` for money, `DATETIME` for timestamps, `ENUM` or lookup tables for fixed sets), and transactions for multi-table writes. Prefer foreign-key constraints plus application-level validation together.

---

## 4. Multi-Tenant Architecture

### Strategy: Shared Database with Logical Tenant Isolation

A single MySQL database (schema) serves all organizations. Every tenant-owned table carries a `tenant_id` column. Isolation is enforced logically at the query layer — every query is scoped by `tenant_id` — not by a separate database per tenant.

**Why this approach:** cost-efficient (one DB server), simple deployment/backup/scaling, and — when query filtering is disciplined — strong logical isolation. It is impossible for one tenant to read another tenant's data because every query includes a `WHERE tenant_id = ?` predicate (via the ORM's tenant-scoped filter).

### The Two Orthogonal Controls (apply to EVERY request, always both)

- **Tenant isolation** decides *whose data* you can touch. Every tenant-owned row carries `tenant_id`; every query filters by it; every "unique" business key is a **composite unique constraint** `(tenant_id, field)`.
- **RBAC** decides *what you can do*. Every route passes through role middleware; every mutating controller re-checks permission.

These are independent. Role controls the action; tenant controls the data scope. Both checks run on every request.

### Data Isolation Rules

```
EVERY tenant-owned table MUST have:
├── tenant_id      (indexed, FK → tenants.tenant_id)
├── created_by / updated_by   (audit)
└── created_at / updated_at   (timestamps)

EVERY query MUST filter by tenant_id (via the ORM):
→ prisma.vehicle.findMany({ where: { tenantId: req.user.tenantId, ...filters } })
   (SQL: SELECT ... FROM vehicles WHERE tenant_id = ? AND ...)

EVERY uniqueness rule MUST be per-tenant (composite unique):
→ @@unique([tenantId, registrationNumber])
   (SQL: UNIQUE KEY uq_vehicle_reg (tenant_id, registration_number))

EVERY cross-entity relationship MUST be same-tenant:
→ site.tenantId === vehicle.tenantId  (validated before linking)

EVERY read-by-id MUST be tenant-scoped:
→ findFirst({ where: { id, tenantId } })  → not found ⇒ 404
   (never findUnique by id alone, which would ignore the tenant)

EVERY response SHOULD be verified (defense in depth):
→ if (row.tenantId !== req.user.tenantId) throw Forbidden

EVERY aggregate/report query's WHERE clause starts with:
→ WHERE tenant_id = ?    (before any other filter/GROUP BY)
```

> **Prisma tenant-scoping note:** `findUnique` only accepts unique fields and cannot mix in `tenantId` unless it is part of a composite unique key. For tenant-scoped single-row reads, use `findFirst({ where: { id, tenantId } })` so a row belonging to another tenant is treated as "not found" (404). Optionally centralize this with a Prisma extension/middleware that injects `tenantId` into every query.

---

## 5. Organization / Tenant Structure

Each **Organization** is a **Tenant**. A tenant owns all its assets, users, sites, maintenance records, fuel records, tyres, compliance documents, and audit history.

### Tenant Entity

| Field | Description |
|-------|-------------|
| `tenantId` | Unique organization identifier (e.g. `tenant_<uniqueId>`), globally unique. Stored as the `tenant_id` string business key used for scoping across all tables (a surrogate numeric/UUID PK on `tenants` is also fine, but `tenant_id` is the value embedded in the JWT and used in every `WHERE tenant_id = ?`). |
| `organizationName` | Display name of the organization |
| `email`, `phone`, `address` | Organization contact info |
| `status` | `active` / `suspended` / `inactive` |
| `primaryAdminId` | The founding admin user |
| `createdAt`, `updatedAt` | Timestamps |

### User–Tenant–Role Relationship

A **User** (identity, unique email) is linked to a **Tenant** through a **TenantMember** record that carries the **role**. This separation allows the identity to exist independently of any single organization's role assignment.

```
User (identity, unique email)
   │
   └── TenantMember { tenantId, userId, role, status }
                                        │
                                        └── role ∈ { admin, supervisor }
```

The first user who signs up and creates an organization automatically becomes that organization's **Admin**.

---

## 6. Tenant ID Flow & Data Isolation

The `tenantId` originates at authentication and flows unchanged through every layer.

```
1. LOGIN
   → resolve user → resolve TenantMember → embed tenantId + role in JWT

2. REQUEST
   → client sends: Authorization: Bearer <jwt>

3. MIDDLEWARE (extractTenantAndRole)
   → verify JWT → decode tenantId + role → confirm membership active
   → attach to req.user = { id, tenantId, role, ... }

4. CONTROLLER
   → read tenantId from req.user (never from body/query/params)

5. SERVICE
   → include tenantId in all business logic & validation

6. REPOSITORY / DB (ORM)
   → where: { tenantId, ...filters }   ← ENFORCED (SQL: WHERE tenant_id = ?)

7. RESPONSE VERIFICATION (defense in depth)
   → confirm every returned row.tenantId === req.user.tenantId
```

**Critical:** `tenantId` is taken ONLY from the verified JWT (`req.user.tenantId`). It is never accepted from the request body, query string, or URL params — that would allow tenant spoofing.

### Isolation Example

If Tenant A requests a vehicle that belongs to Tenant B (even with the correct row ID), the query `findFirst({ where: { id, tenantId: "tenant_A" } })` (SQL: `SELECT ... FROM vehicles WHERE id = ? AND tenant_id = 'tenant_A'`) returns `null`, and the API responds **404 Not Found** — never revealing that the row exists in another tenant. Never fetch by primary key alone (`findUnique({ where: { id } })`), as that bypasses tenant scoping.

---

## 7. Authentication & Authorization

### Authentication (who you are)

- JWT-based. The access token embeds `userId`, `email`, `tenantId`, `role`, and `membershipId`.
- Passwords hashed with **bcrypt** (10+ rounds).
- Token expiration configured (default 24h) via env.
- Protected API routes AND protected frontend routes.
- Generic, non-leaking error messages ("Invalid email or password" — never "email not found").
- No credentials or secrets in frontend source; all secrets in env.

### Authorization (what you can do)

Authorization is enforced by a **central permission configuration** plus route middleware plus per-controller checks:

- `extractTenantAndRole` — verifies JWT, loads tenant + role, confirms membership is active.
- `checkRole(allowedRoles)` — gate that allows only listed roles.
- Route helpers:
  - `protectAdminRoute` → admin only.
  - `protectSupervisorRoute` → admin **and** supervisor (i.e. "supervisor-level and up").
- Controller-level `hasPermission(role, resource, action)` re-check — defense in depth against route misconfiguration.

**Middleware chain per request:** `extractTenantAndRole` → `checkRole(...)` → controller (which re-checks `hasPermission` for mutations).

---

## 8. Roles: Admin & Supervisor

Each organization supports exactly two roles. Both belong to the same tenant; their data scope is identical (their own organization), but their allowed actions differ.

### Admin
Full control within the organization: create, view, edit, **and delete** assets and related records; manage users (invite, change role, deactivate); export reports; manage all modules.

### Supervisor
Operational access within the organization: **create, view, and edit** assets and related records — but **cannot delete**. Cannot manage users. Cannot export reports (view/print only).

### The Governing Asset Permission Rule (explicitly requested)

> **Admin:** Create, view, edit, and delete assets.
> **Supervisor:** Create, view, and edit assets — but **cannot delete** assets.

Delete is the one asset-class action locked to Admin. This same pattern (create/edit for both, delete for admin only) extends to the related operational modules (maintenance, fuel, tyres, compliance) unless stated otherwise.

---

## 9. Role-Based Permission Matrix

`config/permissions.js` is the **single source of truth**. When a rule changes, edit this one object — not the route files.

```javascript
// config/permissions.js

export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor'
};

export const PERMISSIONS = {
  ASSET: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']                 // admin ONLY
  },
  VEHICLE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']                 // admin ONLY
  },
  MACHINERY: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']                 // admin ONLY
  },
  MAINTENANCE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']                 // admin ONLY
  },
  SERVICE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']
  },
  TYRE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],  // install/remove = edit-class
    DELETE: ['admin']
  },
  FUEL: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']
  },
  COMPLIANCE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    DELETE: ['admin']
  },
  SITE: {
    CREATE: ['admin', 'supervisor'],
    READ:   ['admin', 'supervisor'],
    UPDATE: ['admin', 'supervisor'],
    ASSIGN: ['admin', 'supervisor'],
    DELETE: ['admin']
  },
  REPORTS: {
    VIEW:   ['admin', 'supervisor'],
    PRINT:  ['admin', 'supervisor'],
    EXPORT: ['admin']                 // export admin ONLY
  },
  USERS: {
    INVITE:      ['admin'],
    LIST:        ['admin'],
    CHANGE_ROLE: ['admin'],
    DEACTIVATE:  ['admin'],
    VIEW_PROFILE: ['admin', 'supervisor']
  },
  DASHBOARD: {
    VIEW:                 ['admin', 'supervisor'],
    VIEW_ALL_METRICS:     ['admin'],
    VIEW_SUMMARY_METRICS: ['admin', 'supervisor']
  }
};

export function hasPermission(userRole, resource, action) {
  const allowed = PERMISSIONS[resource]?.[action];
  if (!allowed) {
    console.warn(`Unknown permission: ${resource}.${action}`);
    return false;
  }
  return allowed.includes(userRole);
}
```

### Compact Permission Table

| Action | Admin | Supervisor |
|--------|:-----:|:----------:|
| Create asset (vehicle/machinery) | ✓ | ✓ |
| View asset | ✓ | ✓ |
| Edit asset | ✓ | ✓ |
| **Delete asset** | ✓ | **✗** |
| Record maintenance / service | ✓ | ✓ |
| Delete maintenance record | ✓ | ✗ |
| Add fuel transaction | ✓ | ✓ |
| Delete fuel transaction | ✓ | ✗ |
| Install / remove tyre | ✓ | ✓ |
| Delete tyre record | ✓ | ✗ |
| Manage compliance docs | ✓ | ✓ |
| Delete compliance doc | ✓ | ✗ |
| View reports | ✓ | ✓ |
| Print reports | ✓ | ✓ |
| **Export reports** | ✓ | **✗** |
| View dashboard | ✓ | ✓ |
| Invite users | ✓ | ✗ |
| Change user roles | ✓ | ✗ |
| Deactivate users | ✓ | ✗ |

> **Security note:** Hiding a button in the UI is convenience, not enforcement. The real gate is the route middleware + controller `hasPermission` check. A supervisor crafting a raw `DELETE /api/vehicles/:id` still receives **403**. Never rely on the frontend alone.

---

## 10. Login, Sign Up & Forgot Password

### Sign Up (creates Organization + first Admin)

1. User submits organization name, email, password, name.
2. Validate inputs (email format, password ≥ 8 chars, org name present).
3. Reject if email already exists (generic conflict message).
4. Create `Tenant` (generate unique `tenantId`).
5. Create `User` (bcrypt-hashed password).
6. Create `TenantMember` with `role: 'admin'` — the founder is Admin.
7. Set tenant `primaryAdminId`.
8. Issue JWT `{ userId, tenantId, role: 'admin' }`.

### Login

1. Find user by email; verify account `active`.
2. Verify password (bcrypt).
3. Load active `TenantMember` → resolve `tenantId` + `role`.
4. Reject if no active membership or invalid role.
5. Issue JWT embedding `tenantId` + `role`.
6. Update `lastLoginAt`.

### Forgot / Reset Password

- Configurable mechanism: email reset link or OTP (default: email reset link).
- Never expose whether an email exists (respond identically either way).
- Reset tokens are single-use and time-limited.
- New password hashed with bcrypt.

### Logout

- Client discards token. (Optional server-side token blacklist if configured.)

---

## 11. Asset Master (Common Concept)

Assets are primarily Vehicles and Machinery, unified by a common Asset concept and shared behaviors (search/filter/sort/pagination, archive-instead-of-delete, audit logging).

### Common Asset Fields

Asset ID, Category, Type, Registration Number (where applicable), Model Number, Chassis Number, Year, Current KM (vehicles), Current Hours (machinery), Fuel Type, Current Site, Status, Active/Inactive state, Next Service KM (vehicles), Next Service Hours (machinery).

### Asset Operations

Create, View, Edit, Activate, Deactivate, Search, Filter, Sort, Paginate. **Delete is admin-only** (see Section 15).

### Per-Tenant Uniqueness

- Asset ID unique **per tenant**: `UNIQUE (tenant_id, asset_id)`.
- Registration Number unique **per tenant**: `UNIQUE (tenant_id, registration_number)`.

The same registration number may legitimately exist in two different organizations.

---

## 12. Vehicle Module

Vehicles are **KM/odometer-based**.

### Vehicle-Specific Fields
Registration Number (unique per tenant), Current KM, Next Service KM, service interval (KM), tyres, fuel records, compliance docs.

### Vehicle Business Logic
- **Service-due:** vehicle is due when `currentKM >= nextServiceKM` (or a date threshold if configured).
- **Fuel efficiency:** KM/Litre computed from consecutive fuelling odometer readings.
- KM readings must be monotonically non-decreasing; reject a new reading lower than the last recorded reading.

---

## 13. Machinery Module

Machinery is **operating-hours-based**.

### Machinery-Specific Fields
Model/Type, Current Hours (hour meter), Next Service Hours, service interval (hours), insurance, fuel records, maintenance.

### Machinery Business Logic
- **Service-due:** machine is due when `currentHours >= nextServiceHours`.
- **Fuel cost per operating hour:** total fuel cost ÷ operating hours over a period.
- Hour readings must be monotonically non-decreasing; reject a lower-than-last reading.

> **Reminder:** Machinery logic must never reuse vehicle KM logic and vice versa.

---

## 14. Asset Creation & Management

Both **Admin and Supervisor** can create, view, and edit assets.

### Creation Flow (Vehicle example)
1. UI form (role-gated: create button visible to both roles).
2. Frontend validation (required fields, formats).
3. `POST /api/vehicles` with JWT.
4. `extractTenantAndRole` → `protectSupervisorRoute` (admin+supervisor).
5. Controller re-checks `hasPermission(role, 'VEHICLE', 'CREATE')`.
6. Uniqueness check scoped to tenant.
7. Create row stamped with `tenantId` + `createdBy`.
8. Audit log the creation.
9. Return `201` + created resource.

### Edit Flow
Same chain, `UPDATE` permission (both roles), tenant-scoped lookup (`findFirst({ where: { id, tenantId } })` → 404 if not found), store before-state, apply update, audit log before/after, return updated resource.

---

## 15. Asset Deletion & DELETE-Word Verification

### Deletion is Admin-Only
Delete routes use `protectAdminRoute`. The controller additionally enforces `hasPermission(role, <RESOURCE>, 'DELETE')`. A supervisor's raw delete request → **403** with message "Only admins can delete …".

### Archive Instead of Hard Delete
To preserve historical integrity, deletion **archives** the asset (soft delete: set `status = 'archived'`, `archived_at`, `archived_by`) rather than issuing a SQL `DELETE`. Dependencies (fuel, maintenance, assignments, tyres, compliance) are checked first; historical rows are preserved via their foreign keys. Use `ON DELETE RESTRICT` on child foreign keys so the database itself refuses to hard-delete an asset that still has dependent records. No silent data destruction.

### DELETE-Word Verification (Confirmation Safeguard)

Deleting an asset is a high-impact action and requires **typed confirmation**. The admin must type the exact word **`DELETE`** (case-sensitive, uppercase) into a confirmation field before the delete can proceed.

**Frontend behavior:**
- A confirmation modal opens showing the asset identity (e.g. registration number) and a warning.
- An input field requires the user to type `DELETE` exactly.
- The confirm button stays **disabled** until the typed value strictly equals `DELETE`.
- On confirm, the client sends the delete request including the confirmation value.

**Backend behavior (authoritative):**
- The delete endpoint requires a body field, e.g. `{ "confirmation": "DELETE" }`.
- The server rejects the request with **400** if `confirmation !== 'DELETE'`, regardless of the frontend.
- Only after passing the DELETE-word check AND the admin role check does archiving proceed.

```javascript
// controllers/vehicleController.js  (delete)
async function deleteVehicle(req, res) {
  const { id } = req.params;
  const { confirmation } = req.body;
  const { tenantId, role, id: userId } = req.user;

  // 1. Role gate (admin only) — defense in depth
  if (!hasPermission(role, 'VEHICLE', 'DELETE')) {
    return res.status(403).json({ error: 'Only admins can delete vehicles' });
  }

  // 2. DELETE-word verification (server-authoritative)
  if (confirmation !== 'DELETE') {
    return res.status(400).json({
      error: 'Deletion not confirmed. Type DELETE to confirm.'
    });
  }

  // 3. Tenant-scoped lookup (never findUnique by id alone)
  const vehicle = await prisma.vehicle.findFirst({ where: { id: Number(id), tenantId } });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // 4. Archive (soft delete, never SQL DELETE) + audit — wrap in a transaction
  const before = { ...vehicle };
  const archived = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'archived', archivedAt: new Date(), archivedBy: userId }
    });
    await tx.auditLog.create({
      data: {
        tenantId, userId, entityType: 'vehicle', entityId: String(vehicle.id),
        action: 'delete', before: before, after: updated
      }
    });
    return updated;
  });

  return res.json({ data: archived, message: 'Vehicle archived successfully' });
}
```

---

## 16. Maintenance Management

Two maintenance types, both tenant-scoped and role-gated (create/edit for both roles; delete admin-only).

### Preventive Maintenance
- Scheduled based on the asset type:
  - Vehicles → **KM** thresholds (`nextServiceKM`).
  - Machinery → **operating-hours** thresholds (`nextServiceHours`).
- On completion, the system recalculates the next service target (add the interval to the current KM/hours).
- Dashboard surfaces upcoming and overdue services.

### Breakdown Maintenance
- Records unplanned failures.
- Tracks **downtime**: from breakdown start to resolution.
- Status transitions (e.g. `reported → in_progress → resolved`).
- Feeds breakdown/downtime reports and dashboard alerts.

### Common Maintenance Fields
Asset reference, type (preventive/breakdown), reported date, start/end, status, description, labour, cost, downtime, parts consumed (see Section 17), performed-by, completion date.

---

## 17. Record Service & Parts Consumed

### Record Service
A **Record Service** action logs a completed service against an asset. It captures: service date, service type, meter reading at service (KM for vehicles, hours for machinery), labour, cost, notes, and **parts consumed**. On save, it updates the asset's current meter reading (validated non-decreasing) and recalculates the next service target for preventive services.

### Parts Consumed — Manual Text Entry (explicitly requested)

Parts consumed during a service are entered as **free-form manual text entries**. There is **no fixed parts master/catalog requirement** — the user types part details directly. This keeps data entry fast and flexible for varied real-world parts.

**Data model (relational):** Because MySQL is relational, parts consumed is a **child table** (`service_parts`) with a foreign key to the parent service/maintenance record — not an embedded array. Each row still supports a free-text `description` (the manual entry — not a dropdown/foreign key), plus optional quantity and cost. When a service is saved, its part rows are inserted in the **same transaction** as the parent record; deleting/replacing parts on edit is also transactional.

```prisma
// schema.prisma
model Service {
  id             Int            @id @default(autoincrement())
  tenantId       String         @map("tenant_id")
  assetId        Int            @map("asset_id")
  assetType      AssetType      @map("asset_type")      // VEHICLE | MACHINERY
  serviceDate    DateTime       @map("service_date")
  serviceType    String         @map("service_type")
  meterReading   Decimal        @map("meter_reading") @db.Decimal(12, 2) // KM or hours
  labourCost     Decimal?       @map("labour_cost")   @db.Decimal(12, 2)
  totalCost      Decimal?       @map("total_cost")    @db.Decimal(12, 2)
  notes          String?        @db.Text
  createdBy      String         @map("created_by")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt      @map("updated_at")
  parts          ServicePart[]

  @@index([tenantId, assetId])
  @@map("services")
}

model ServicePart {
  id          Int      @id @default(autoincrement())
  tenantId    String   @map("tenant_id")               // denormalized for tenant-scoped queries
  serviceId   Int      @map("service_id")
  description String   @db.Text                          // MANUAL TEXT ENTRY (required)
  quantity    Decimal? @default(1) @db.Decimal(12, 2)   // optional
  unitCost    Decimal? @map("unit_cost") @db.Decimal(12, 2) // optional
  lineCost    Decimal? @map("line_cost") @db.Decimal(12, 2) // optional (quantity * unitCost)
  note        String?  @db.Text                          // optional manual note
  service     Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([tenantId, serviceId])
  @@map("service_parts")
}
```

Note the `service_parts.service_id` FK uses `ON DELETE CASCADE` so a service's part rows are cleaned up with it, while the service→asset relationship uses `ON DELETE RESTRICT` (assets are archived, never hard-deleted). `description` is a required free-text column; there is deliberately **no** `part_id` foreign key to any catalog.

**UI behavior:**
- A repeatable row lets the user add multiple parts.
- Each row has a **manual text input** for the part description (required), plus optional quantity/cost.
- "Add part" adds another row; each row is removable.
- Total parts cost may be auto-summed from line costs for display.

**Validation:** description is required per row; quantity/cost, if provided, must be non-negative numbers.

---

## 18. Tyre Management

Tyre master and lifecycle, tenant-scoped. Install/remove are edit-class (both roles); deletion admin-only.

- **Install/Remove:** attach a tyre to a vehicle position; record install meter reading.
- **Running KM:** accumulate distance run since install (derived from vehicle KM progression).
- **Position conflict prevention:** no two active tyres in the same position on one vehicle.
- **History:** full install/removal history preserved.

**Status: Completed** — also includes rotate (swap positions), scrap, and running hours for hours-based Heavy Vehicles (see Phase 8 "As built" in the phase plan).

---

## 19. Fuel Tracking & Cost Calculation

Fuel transactions are tenant-scoped; create/edit for both roles, delete admin-only.

### Fuel Transaction Fields
Asset reference, date, quantity (litres), rate/price per litre, **amount/cost** (auto-calculated), meter reading at fuelling (KM for vehicles, hours for machinery), site, notes.

### Calculations
- **Amount:** `amount = quantity × pricePerLitre` (auto-calculated; server-authoritative).
- **Vehicle KM/Litre:** over a period, `totalKM / totalLitres` using consecutive odometer readings (needs ≥ 2 fuel entries).
- **Machinery fuel cost per operating hour:** `totalFuelCost / operatingHours` over a period.

### Validation
- Reject invalid meter readings: a new reading lower than the last recorded reading is rejected (both KM and hours).
- Quantity and price must be positive numbers.

### Status: Completed — as built (client's real workflow)
This module is **complete** (backend and frontend). Everything above still applies; it was extended to match how fuel actually reaches assets on site:

```
Carrier vehicle collects fuel in cans at a pump → fuel received at the site (site fuel stock)
  → fuel issued to vehicles / machinery from site stock
```

- **Fuel stations** — Admin-managed list of pumps.
- **Fuel collections** — fuel bought at a pump and carried in cans (number of cans × litres per can, rate per litre; litres and amount auto-calculated). A collection is *in transit* until the site **receives** it; the litres that actually arrive are added to site stock and any shortfall is recorded as **transit loss**. Diesel and Petrol only (CNG is filled direct at the pump).
- **Site fuel stock** — litres on hand, average cost per litre and stock value per site and fuel type, with a permanent movement ledger; stock can never go below zero.
- **Fuel issues** — the fuel transaction above, now with a **source**: *From site stock* (cost = litres × the site's average cost) or *Direct at pump* (price entered). KM/Litre and cost per operating hour work as specified, from both sources. Heavy Vehicles are hours-based, so they get cost per hour.
- **Fuel reports** — site fuel register, fuel by asset, collections by station and carrier.
- **Roles** — both roles record collections, receive and issue at their own site; Admin only: fuel stations, cancelling a collection, deleting a fuel issue.

Full build detail: `VMMS_PHASE_PLAN.md` Phase 9, "As built".

---

## 20. Compliance & Document Expiry

Compliance documents (insurance, permits, registration, etc.) are tenant-scoped; create/edit for both roles, delete admin-only. File attachments supported.

### Expiry Rules (explicit)
- **Expired document → Critical.**
- **Insurance expiring within 15 days → Priority Alert.**
- The dashboard surfaces both, sorted by severity.

Each document: type, asset reference, issue date, expiry date, document number, attachment, status (valid/expiring/expired).

### Status: Completed — as built
This module is **complete** (backend and frontend). Everything above applies, with these client-requested refinements:

- **Five document types**: Road Tax (OTT / LTT / Other; only "Other" has an expiry date), National Permit, Insurance, State Permit and Fitness. Each has an optional document number. They are entered inside the vehicle and machinery create/edit forms, one record per asset and type.
- **The 15-day Priority Alert applies to all five types**, not Insurance alone. Expired → Critical, as specified.
- **Compliance Documents page** (sidebar → Compliance). It opens on alerts, severity-ordered, with Critical / Priority / Valid / No-expiry counts and filters. "Update" opens the asset's edit form. Each asset page has a Compliance button that opens this page filtered to that asset. Compliance is entered and edited only on the asset forms.
- **No delete** (client's request; supersedes "delete admin-only" above). Compliance records can be updated but not deleted, in the UI or the API.
- **API**: `GET /api/compliance` (list with filters and bucket counts) and `GET /api/compliance/alerts` (Critical and Priority Alert documents, severity-ordered, for the Phase 11 dashboard).
- Attachments remain Phase 14 work. RC/PUC/permit/insurance files are already uploaded as asset documents.

Full build detail: `VMMS_PHASE_PLAN.md` Phase 10, "As built".

---

## 21. Sites / Projects & Assignments

Site master plus asset-to-site assignment with history.

- **Same-tenant rule:** a site and the asset assigned to it must share the same `tenantId` (validated before linking).
- **Overlap prevention:** an asset cannot be actively assigned to two sites at once — assigning to a new site closes the previous active assignment.
- **History:** every assignment (with assigned/unassigned timestamps) is preserved.
- Manage/assign: both roles (assignment is edit-class). Hard-delete of site/history: admin-only.

---

## 22. Dashboard

Tenant-scoped KPIs and alerts aggregating all modules. Every aggregate/report query is tenant-scoped — its `WHERE` clause begins with `tenant_id = ?` before any `GROUP BY`, `JOIN`, or date filter (SQL `COUNT`/`SUM`/`GROUP BY` over the tenant's rows only).

### KPIs
Total vehicles, total machinery, vehicles service-due, machinery service-due, compliance expired, compliance expiring (≤15 days), active breakdowns, monthly fuel cost.

### Alerts (severity-ordered)
Compliance expired (Critical), insurance ≤15 days (Priority Alert), service-due, ongoing breakdowns (with elapsed downtime).

### Role shaping
Both roles view the dashboard. Admins may additionally see full cost analytics; supervisors see operational summary metrics.

---

## 23. Reports Hub & Printing Behavior

### Reports Hub
A central hub listing all report types: Asset, Maintenance, Fuel, Tyre, Compliance, Breakdown, Site, and Cost reports. Each report supports search, filter, sort, and pagination — all tenant-scoped.

### Roles
- **View & Print:** both Admin and Supervisor.
- **Export (Excel/PDF):** **Admin only** — export endpoints use `protectAdminRoute`.

### Printing Behavior (explicit)
- Every report has a **Print** action available to both roles.
- Printing uses a **clean, print-optimized layout**: organization name/header, report title, applied filters, generation timestamp, and the tenant's data only.
- The print view strips navigation, sidebars, and interactive controls (print-specific CSS / print stylesheet) so the printed output is a clean document.
- Printed data is strictly the current tenant's data reflecting the active filters.

---

## 24. Database Structure & Relationships

MySQL relational schema. All tenant-owned tables include `tenant_id` (FK → `tenants.tenant_id`, indexed), `created_by`, `updated_by`, `created_at`, `updated_at`. Use `DECIMAL` for money and meter readings, `DATETIME` for dates, `ENUM` or lookup tables for fixed value sets, and real foreign keys throughout. Column names are `snake_case` in the database; the ORM maps them to camelCase in code (shown via Prisma `@map`).

### Core Tables
- `tenants` — organizations (PK `tenant_id` business key, or surrogate PK + unique `tenant_id`).
- `users` — identities (unique email).
- `tenant_members` — links user ↔ tenant with role; **unique `(tenant_id, user_id)`**; FKs to both.
- `vehicles` — KM-based assets.
- `machinery` — hours-based assets.
- `sites` — projects/sites.
- `site_assignments` — asset ↔ site history (assign/unassign timestamps).
- `maintenance` — preventive & breakdown records.
- `services` — record-service entries. **Parent of `service_parts`.** *(May be unified with `maintenance` if preferred; if so, `service_parts` FKs to the unified table. Document the choice.)*
- `service_parts` — **manual free-text parts consumed** (child of `services`; FK `service_id`, `ON DELETE CASCADE`). No parts catalog.
- `tyres` — tyre master + lifecycle.
- `tyre_assignments` — tyre install/remove history by vehicle position.
- `fuel_transactions` — fuel records.
- `compliance_documents` — compliance/insurance docs.
- `audit_logs` — change history (`before`/`after` stored as JSON columns).
- `attachments` — file metadata (path/reference + `tenant_id`).

Because vehicles and machinery are measured differently (KM vs hours) and must never be mixed, keep them as **two separate tables** rather than one polymorphic asset table. Where a record can reference either (maintenance, fuel, service, compliance, assignments), model the link with an `asset_type` ENUM (`VEHICLE` | `MACHINERY`) plus `asset_id`, and validate the referenced row exists in the matching table within the same tenant. (A shared `assets` supertable with per-type detail tables is an acceptable alternative if you prefer enforceable FKs — document the choice.)

### Key Indexes & Constraints (per-tenant)
```
vehicles:             UNIQUE (tenant_id, asset_id), UNIQUE (tenant_id, registration_number),
                      INDEX (tenant_id, status), INDEX (tenant_id, current_site_id),
                      INDEX (tenant_id, created_at)
machinery:            UNIQUE (tenant_id, asset_id), INDEX (tenant_id, status),
                      INDEX (tenant_id, created_at)
tenant_members:       UNIQUE (tenant_id, user_id), INDEX (tenant_id, status), INDEX (user_id, status)
users:                UNIQUE (email)
sites:                UNIQUE (tenant_id, site_code), INDEX (tenant_id, status)
site_assignments:     INDEX (tenant_id, asset_type, asset_id, assigned_at)
maintenance:          INDEX (tenant_id, asset_type, asset_id, type), INDEX (tenant_id, status),
                      INDEX (tenant_id, completed_at)
services:             INDEX (tenant_id, asset_type, asset_id, service_date)
service_parts:        INDEX (tenant_id, service_id)   -- FK service_id → services(id) ON DELETE CASCADE
fuel_transactions:    INDEX (tenant_id, asset_type, asset_id, txn_date)
compliance_documents: INDEX (tenant_id, expiry_date), INDEX (tenant_id, asset_type, asset_id)
tyres:                UNIQUE (tenant_id, tyre_code), INDEX (tenant_id, status)
tyre_assignments:     INDEX (tenant_id, vehicle_id, position, installed_at)
audit_logs:           INDEX (tenant_id, entity_type, created_at), INDEX (tenant_id, entity_id, created_at)
```

Foreign-key delete behavior: child records that represent history use `ON DELETE RESTRICT` against assets (so an asset with dependents cannot be hard-deleted — it is archived instead); pure children of a single parent (e.g. `service_parts` → `services`) use `ON DELETE CASCADE`.

### Relationships (all same-tenant, enforced by FK + application check)
```
tenants (1) ───< tenant_members >─── (1) users          [M:N via tenant_members, role on the link]
tenants (1) ───< vehicles / machinery / sites / fuel_transactions / maintenance / tyres / compliance_documents
vehicles|machinery (1) ───< site_assignments >─── (1) sites
vehicles|machinery (1) ───< maintenance / services / fuel_transactions / compliance_documents   [via asset_type + asset_id]
services (1) ───< service_parts                          [manual parts, ON DELETE CASCADE]
vehicles (1) ───< tyre_assignments >─── (1) tyres        [by position]
(any entity) (1) ───< audit_logs
```

Every cross-table write that spans multiple tables (e.g. create service + its parts, assign asset + close previous assignment, archive asset + write audit log) runs inside a **single database transaction** so partial writes cannot occur.

---

## 25. API Structure & Workflow

### Conventions
- Base path `/api`. RESTful resource routes. JSON request/response.
- Consistent response envelope: `{ data, message }` on success; `{ error }` on failure.
- Consistent HTTP codes: 200/201 success, 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found (also used for cross-tenant), 409 conflict.
- Pagination via `?page=&limit=`, returning `{ data, pagination: { page, limit, total, pages } }`.

### Representative Endpoints

```
# Auth
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/logout

# Users (admin only)
POST   /api/users/invite            [admin]
GET    /api/users                   [admin]
PUT    /api/users/:userId/role      [admin]
DELETE /api/users/:userId           [admin]
GET    /api/users/me/profile        [admin, supervisor]

# Vehicles
POST   /api/vehicles                [admin, supervisor]
GET    /api/vehicles                [admin, supervisor]
GET    /api/vehicles/:id            [admin, supervisor]
PUT    /api/vehicles/:id            [admin, supervisor]
DELETE /api/vehicles/:id            [admin]  (requires { confirmation: "DELETE" })
GET    /api/vehicles/:id/history    [admin, supervisor]

# Machinery (same shape as vehicles)
POST/GET/PUT [admin, supervisor]; DELETE [admin] + DELETE-word

# Maintenance / Service
POST   /api/maintenance             [admin, supervisor]
PUT    /api/maintenance/:id         [admin, supervisor]
DELETE /api/maintenance/:id         [admin]
POST   /api/services                [admin, supervisor]   (includes partsConsumed[])

# Tyres
POST   /api/tyres                   [admin, supervisor]
POST   /api/tyres/:id/install       [admin, supervisor]
POST   /api/tyres/:id/remove        [admin, supervisor]
DELETE /api/tyres/:id               [admin]

# Fuel
POST   /api/fuel                    [admin, supervisor]
GET    /api/fuel                    [admin, supervisor]
DELETE /api/fuel/:id                [admin]

# Compliance
POST   /api/compliance              [admin, supervisor]
GET    /api/compliance              [admin, supervisor]
DELETE /api/compliance/:id          [admin]

# Sites & assignments
POST   /api/sites                   [admin, supervisor]
POST   /api/sites/assign            [admin, supervisor]
DELETE /api/sites/:id               [admin]

# Dashboard & reports
GET    /api/dashboard               [admin, supervisor]
GET    /api/reports/:type           [admin, supervisor]   (view/print)
GET    /api/reports/:type/export    [admin]               (excel/pdf)
```

### Request Workflow (mutation)
```
Client → [JWT] → extractTenantAndRole → checkRole(...) → Controller
   → hasPermission re-check → Service (business rules, tenantId)
   → Repository (find/create scoped by tenantId) → DB
   → Audit log → Response envelope
```

---

## 26. Frontend Structure & UI/UX Requirements

### Admin Shell
Sidebar navigation, top header/bar, breadcrumbs, main content area, responsive sidebar, user/account menu with role badge, logout, and a notification/alert area.

### Navigation
```
Dashboard
Asset Management
  ├── All Assets
  ├── Vehicles
  └── Machinery
Maintenance
  ├── Preventive Maintenance
  ├── Breakdown Maintenance
  └── Maintenance History
Tyres
  ├── Tyre Master
  └── Tyre History
Fuel
  └── Fuel Transactions
Compliance
  └── Compliance Documents
Sites / Projects
  ├── Site Master
  └── Asset Assignments
Reports  (Reports Hub)
  ├── Asset / Maintenance / Fuel / Tyre
  ├── Compliance / Breakdown / Site / Cost
Administration  (admin only)
  ├── Users
  └── Invite User
```

### Role-Aware UI
- `RoleContext` + `can()` helper drive conditional rendering.
- Create/Edit controls render for both roles; **Delete controls render only for admins**.
- Admin-only areas (Users, Invite, Export) are hidden from supervisors.
- A role badge (Admin / Supervisor) is shown in the header.

### Design System (build before modules)
Reusable typography, spacing, buttons, inputs, selects, date pickers, search fields, filters, tables, cards, badges, status indicators, modals, drawers, tabs, alerts, toasts, empty states, loading states, skeletons, error states, pagination, breadcrumbs, form sections, file upload, charts. Professional industrial/enterprise visual language. Prioritize clarity, readability, data density, fast navigation, operational status visibility, consistency. Do not overdecorate.

### Responsive Design
Works across desktop (primary), laptop, tablet, and smaller screens. Tables adapt via horizontal scroll, column prioritization, responsive cards, and detail drawers/pages. No unpredictable overflow.

### Consistent States
Every data view implements loading, empty, and error states. Every destructive action uses a confirmation dialog (asset delete uses the DELETE-word modal).

---

## 27. Security Requirements

- **Tenant isolation on every query** (`tenantId` from JWT only, never from client input).
- **RBAC on every route** (`checkRole`) **and every mutation controller** (`hasPermission`).
- **Both tenant + role validated** on each request; failures return generic errors.
- **Cross-tenant access → 404** (never reveal existence in another tenant).
- **Per-tenant composite unique constraints** for critical identifiers, e.g. `UNIQUE (tenant_id, registration_number)` — enforced at the database level, not only in code.
- **Same-tenant relationship validation** before linking entities.
- **DELETE-word verification** enforced server-side for asset deletion.
- **bcrypt** password hashing; **JWT** with expiry; secrets in env.
- **No credentials/secrets in frontend**; no hardcoded production data.
- **Audit logging** of create/update/delete/status-change/assignment/role-change with who/what/when/before/after and `tenantId`.
- **Response verification** (defense in depth) confirming returned docs match `req.user.tenantId`.
- Admin cannot remove their own admin role (prevents lockout).
- Rate limiting and input sanitization recommended.

---

## 28. Data Storage Requirements

- **MySQL** single instance/schema, shared across tenants, logically isolated by `tenant_id`.
- **Relational integrity:** real foreign keys, `NOT NULL` where required, `DECIMAL` for money/meter values, `ENUM`/lookup tables for fixed sets. Multi-table writes wrapped in transactions.
- **Schema migrations:** all schema changes go through ORM-managed migrations (Prisma Migrate / Sequelize migrations), version-controlled — never manual ad-hoc DDL in production.
- **Historical preservation:** archive instead of hard delete (soft-delete via `status = 'archived'`); child FKs use `ON DELETE RESTRICT` so history cannot be silently destroyed.
- **Audit logs** retained for accountability and forensics (`before`/`after` as JSON columns).
- **File attachments** (compliance docs, etc.) stored on disk or S3-compatible storage (configurable); store metadata + path/reference in a DB table, scoped by `tenant_id`.
- **Indexes** created for all tenant-scoped filter columns for performance (see Section 24).
- **Backups**: single-DB (mysqldump / managed snapshot) backup/restore strategy documented.
- **Migration:** normalize the supplied Excel workbook into the relational schema; every migrated row stamped with the correct `tenant_id` and inserted respecting foreign-key order (tenants → users/assets → dependent records). Do not reproduce spreadsheet structure directly.

---

## 29. Validation & Error Handling

### Validation (both layers)
- **Frontend:** required fields, formats, positive numbers, DELETE-word match to enable confirm button.
- **Backend (authoritative):** all critical rules re-validated server-side — uniqueness (per tenant), meter-reading monotonicity (KM/hours non-decreasing), positive quantities/costs, valid role, valid enum values, DELETE-word confirmation.

### Error Handling
- Centralized error handler producing consistent `{ error }` responses.
- Correct status codes (400/401/403/404/409/500).
- Generic, non-leaking messages for auth and cross-tenant cases.
- Graceful handling of DB/validation/permission errors.
- Frontend surfaces errors via toasts/alerts and inline field errors; never crashes on API error.

---

## 30. Production Coding Standards & Architecture

### Architecture Layers (backend)
```
routes → middleware → controllers → services → repositories → models
                                   (permissions, validation, audit as shared services)
```
- **Separation of concerns:** controllers thin, services hold business logic, repositories hold data access.
- **Reusable** components, services, validation, and API utilities.
- **Single source of truth** for permissions (`config/permissions.js`).
- **No duplicated business logic**; no mixing vehicle/machinery measurement logic.
- **Consistent** error handling, loading/empty states, confirmation dialogs.
- **Config via env**; `.env.example` provided.
- **Tested:** unit (services + permissions), API (Supertest, including supervisor-cannot-delete and cross-tenant-404), frontend (RTL).
- **Documented:** README, API docs, architecture, migration guide, run/build/test instructions.
- **No placeholders presented as complete**; no invented business data; no hardcoded secrets.

---

## 31. Phase-Wise Development Plan

Multi-tenancy and RBAC are built into the foundation, not added later. Ordering is dependency-aware.

### Phase 0 — Foundation & Scaffolding
Project structure, env config + `.env.example` (including `DATABASE_URL` for MySQL), **MySQL connection + ORM setup (Prisma datasource `mysql`, or Sequelize)** with an initial migration, central error handler, response envelope. Design-system primitives. **Tenant + RBAC core:** `Tenant`, `User`, `TenantMember` models (with `UNIQUE (tenant_id, user_id)` on the membership table and FKs); `extractTenantAndRole`; `checkRole`; `protectAdminRoute` / `protectSupervisorRoute`; `config/permissions.js`. Frontend `TenantContext`, `RoleContext` + `can()`, `ProtectedRoute`, `ProtectedElement`.
**Exit:** MySQL migration applies cleanly; protected test route returns 401 (no token), 403 (wrong role), 200 (correct tenant+role).

### Phase 1 — Authentication & User Management
Login, sign-up (founder = admin, creates tenant), forgot/reset password, logout. JWT with `tenantId`+`role`. Admin-only user management: invite (with role), list, change role, deactivate; admin can't remove own admin role; role changes audited.
**Exit:** admin invites supervisor; supervisor logs in with correct tenant+role; cross-tenant login impossible.

### Phase 2 — Asset Foundation
Common Asset concept; per-tenant uniqueness; search/filter/sort/pagination utilities; archive-instead-of-delete; audit service; DELETE-word verification pattern. RBAC: create/view/edit both roles, delete admin-only.

### Phase 3 — Vehicles
KM-based specialization; registration uniqueness per tenant; current KM; next-service-KM; monotonic KM validation.

### Phase 4 — Machinery
Hours-based specialization; hour meter; next-service-hours; monotonic hours validation. Never reuse vehicle KM logic.

### Phase 5 — Sites & Assignments
Site master; assignment with same-tenant validation, overlap prevention, history.

### Phase 6 — Maintenance & Record Service
Preventive (KM/hours split) + breakdown (downtime, status transitions); Record Service with **parts consumed (manual text entry)**; next-service recalculation.

### Phase 7 — Tyres
Master + install/remove, running KM, position-conflict prevention, history.

### Phase 8 — Fuel
Transactions; amount auto-calc; vehicle KM/Litre; machinery cost/hour; invalid-reading rejection.
**Status: Completed** — extended with fuel stations, collections in cans, receipt into site fuel stock and issue from site stock (see §19 "Status: Completed").

### Phase 9 — Compliance
Documents + expiry detection (expired = Critical; insurance ≤15 days = Priority Alert); attachments.

### Phase 10 — Dashboard
Tenant-scoped KPIs + alerts; role-shaped metrics.

### Phase 11 — Reports Hub
All report types; search/filter; **print (both roles)**; **export (admin only)**; print-optimized layout.

### Phase 12 — Attachments, Audit History, Excel Migration
Finalize attachments; audit/history views (both roles view); migration tooling stamping `tenantId`.

### Phase 13 — Hardening, Testing, Integration, Docs
E2E workflow tests; dedicated tenant-isolation + RBAC suite (cross-tenant 404; supervisor delete 403; role escalation blocked); index/performance review; full documentation set.

### Added — Inventory & Stock Management
Not in the original phase list; added at the client's request and **completed**: item catalog, purchase + receive, stock ledger with oldest-first batch costing, asset issue + reversal, stock adjustment, site-to-site stock transfer (Admin only), stock balances and history. See §37 and `VMMS_PHASE_PLAN.md` Phase 17.

### Cross-cutting (every phase, part of Definition of Done)
Security (tenant filter + role check), audit logging, responsive UI, consistent error/loading/empty states.

---

## 32. End-to-End Workflow

```
Sign Up (org + admin)
  → Admin invites Supervisor (role assigned)
  → Both log in (JWT carries tenantId + role)
  → Create Assets (vehicles/machinery)         [admin + supervisor]
  → Assign Assets to Sites                      [admin + supervisor]
  → Record Preventive / Breakdown Maintenance   [admin + supervisor]
  → Record Service + Parts Consumed (manual)    [admin + supervisor]
  → Install/Remove Tyres, track running KM      [admin + supervisor]
  → Log Fuel (auto amount; KM/L or cost/hour)   [admin + supervisor]
  → Manage Compliance (expiry alerts)           [admin + supervisor]
  → Dashboard shows KPIs & alerts               [both view]
  → Reports Hub: view/print                     [both]
  → Reports export (Excel/PDF)                  [admin only]
  → Delete Asset: DELETE-word + admin only → archived (history kept)
```
Every step is tenant-isolated and role-checked; every change is audit-logged.

---

## 33. Detailed User Flows

### Flow A — Supervisor creates & edits a vehicle (allowed)
1. Supervisor logs in → JWT `{ tenantId, role: supervisor }`.
2. Navigates to Vehicles → "Add Vehicle" (visible to supervisor).
3. Submits form → `POST /api/vehicles`.
4. `protectSupervisorRoute` passes; controller `hasPermission(...,'CREATE')` = true.
5. Per-tenant uniqueness checked; vehicle created with `tenantId`; audit logged → **201**.
6. Supervisor edits later → `PUT` → allowed → audit logged.

### Flow B — Supervisor attempts to delete (blocked)
1. Delete control is hidden in supervisor UI.
2. If a raw `DELETE /api/vehicles/:id` is attempted → `protectAdminRoute` blocks → **403** "Only admins can delete vehicles". No data change.

### Flow C — Admin deletes with DELETE-word
1. Admin clicks Delete → confirmation modal shows asset identity + warning.
2. Admin must type `DELETE`; confirm button enabled only on exact match.
3. `DELETE /api/vehicles/:id` with `{ confirmation: "DELETE" }`.
4. Server: admin check ✓ → confirmation check ✓ → tenant-scoped lookup → **archive** (not hard delete) → audit logged → **200**. History preserved.

### Flow D — Record Service with manual parts
1. User opens Record Service on an asset.
2. Enters meter reading (validated non-decreasing), labour, cost, notes.
3. Adds parts via repeatable rows — **manual text description** per part (required), optional quantity/cost.
4. Saves → service stored with `partsConsumed[]`; asset meter updated; next service recalculated (preventive); audit logged.

### Flow E — Cross-tenant isolation
1. Tenant A admin requests Tenant B's vehicle by ID.
2. `findFirst({ where: { id, tenantId: 'tenant_A' } })` (SQL: `WHERE id = ? AND tenant_id = 'tenant_A'`) → `null` → **404**. Existence in Tenant B never revealed.

### Flow F — Reports print vs export
1. Supervisor opens Reports Hub → view + **Print** (clean print layout, tenant data only).
2. Supervisor sees no Export control; a raw export request → **403**.
3. Admin can **Export** (Excel/PDF) via admin-only endpoint.

---

## 34. Admin vs Supervisor Access Summary

| Capability | Admin | Supervisor |
|-----------|:-----:|:----------:|
| Create / view / edit assets | ✓ | ✓ |
| Delete assets (DELETE-word) | ✓ | ✗ |
| Maintenance & Record Service (create/edit) | ✓ | ✓ |
| Delete maintenance/service | ✓ | ✗ |
| Parts consumed (manual entry) | ✓ | ✓ |
| Tyres install/remove | ✓ | ✓ |
| Delete tyre record | ✓ | ✗ |
| Fuel add/edit | ✓ | ✓ |
| Delete fuel | ✓ | ✗ |
| Compliance manage | ✓ | ✓ |
| Delete compliance | ✓ | ✗ |
| Sites/assignments manage | ✓ | ✓ |
| Delete site | ✓ | ✗ |
| Dashboard view | ✓ | ✓ |
| Reports view / print | ✓ | ✓ |
| Reports export | ✓ | ✗ |
| Invite / manage users | ✓ | ✗ |

Both roles operate strictly within their own tenant. Role controls the action; tenant controls the data.

---

## 35. Acceptance Criteria & Definition of Done

A feature is **done** only when all of these exist:
```
UI + Frontend validation + API + Backend validation + DB model
  + Business logic + Error handling + Loading/empty states
  + Security (tenant + role) + Tests + Documentation
```

Project-level acceptance (highlights):
- **Auth:** login, sign-up (founder=admin), password recovery, protected routes, logout.
- **Multi-tenancy:** every query tenant-scoped; per-tenant uniqueness; cross-tenant access → 404.
- **RBAC:** create/edit both roles; **delete admin-only**; supervisor delete → 403; export admin-only.
- **DELETE-word:** asset deletion requires typed `DELETE`, enforced server-side; deletion archives (history kept).
- **Vehicles:** KM logic, service-due, KM/Litre.
- **Machinery:** hours logic, service-due, cost/hour — never mixed with vehicle logic.
- **Maintenance/Service:** preventive + breakdown, downtime, next-service recalculation, **parts consumed via manual text entry**.
- **Fuel:** amount auto-calc, KM/L, cost/hour, invalid-reading rejection.
- **Compliance:** expired = Critical; insurance ≤15 days = Priority Alert.
- **Sites:** same-tenant assignment, overlap prevention, history.
- **Dashboard:** tenant-scoped KPIs + alerts.
- **Reports Hub:** view/print (both), export (admin), print-optimized layout.
- **Quality:** no critical console errors, no broken routes, no overflow, responsive, errors handled, tests pass, docs complete.

---

## 36. Deliverables

1. Fully implemented frontend (React) and backend (Node/Express).
2. MySQL relational schema (ORM models + migrations) with per-tenant composite unique constraints and indexes.
3. REST APIs with tenant isolation + RBAC.
4. Authentication (JWT, bcrypt) + protected routes.
5. Business rules (KM vs hours, service-due, fuel calcs, expiry rules).
6. DELETE-word verification + archive-based deletion.
7. Parts-consumed manual text entry in Record Service.
8. Validation (frontend + server-authoritative).
9. Dashboard + Reports Hub (print + admin export).
10. Search / filter / sort / pagination.
11. File attachment support.
12. Audit/history functionality.
13. Excel migration tooling + documentation (tenant-stamped).
14. Automated tests (unit, API, frontend) incl. isolation + RBAC suite.
15. Seed/test data where appropriate.
16. `.env.example`, README, API docs, architecture docs, migration docs, run/build/test instructions.

---

### Final Build Directive

Build the complete system end-to-end using this specification as the baseline. Establish the tenant + RBAC foundation first, then implement modules in the phase order above. Enforce tenant isolation and role checks on every request. Do not stop at UI mockups, do not leave core features as placeholders, and do not silently omit requirements. Resolve ambiguity with sensible production-ready defaults and document those decisions. Implement, test, integrate, verify, and document the entire system.

---

## 37. Inventory & Stock Management Module

> **Added after this specification was written**, at the client's request, and **completed** (backend and frontend). Build detail and verification: `VMMS_PHASE_PLAN.md` Phase 17. It follows the same multi-tenant, site and role rules as every other module.

### Purpose
Track parts and consumables: what is bought, where it is kept, what is issued to each vehicle or machine, what moves between sites, and what a physical count corrects — with the correct cost at every step.

### Item Catalog (Admin creates and edits; both roles read)
- **Item categories**, **units of measure**, **items** (optional minimum / reorder / maximum levels drive a stock status: Healthy, Reorder, Low stock), **suppliers** (phone and email validated), **storage locations** (each belongs to one site).
- Catalog records are archived, never hard-deleted.

### Purchase & Receive
- A purchase (`PO-…`) has a supplier, site, date and lines: item, storage location, quantity, **unit price as on the bill (before tax)** and **tax %**.
- The **purchase price** of each line (quantity × unit price + tax) and the purchase total are calculated by the server.
- A purchase has **no stock effect until it is received**. Receiving adds the stock at the **unit price including tax**. A received purchase can't be received again or edited.

### Stock and Cost
- Every stock change is recorded in a permanent transaction history; a balance is kept per site, item and storage location. Stock can never go below zero.
- **Cost by batch, oldest first:** each receipt is kept as a batch with its own price. Stock going out uses the oldest batch first, so every issue is costed at the price actually paid. All prices, costs and values include tax.
- **Stock Balances** show: Available, **Latest price** (newest purchase price, with the previous price if it changed), **Bought at** (prices and quantities of the stock still on hand, oldest first), **Stock value**, status and last movement.

### Movements
- **Asset Issue** (`ISS-…`) — stock issued to a vehicle or machine at its site, with the asset's meter reading (KM for vehicles, hours for machinery — never mixed). Can't exceed available stock.
- **Issue Reversal** (`REV-…`) — returns all or part of an issue to the exact batches it came from; never more than is outstanding.
- **Stock Adjustment** (`ADJ-…`) — counted vs. system quantity; only the difference is posted. Only items with stock at the site can be adjusted.
- **Stock Transfer** (`TRF-…`) — **Admin only**. Dispatch moves nothing; receiving moves stock out of the source and into the destination together, at the same prices, or fails and moves nothing.
- Asset Issue, Stock Adjustment and Stock Transfer only offer items that have stock at the selected site. Purchase offers every item.

### Role Permissions

| Action | Admin | Supervisor |
|---|:---:|:---:|
| Manage item catalog | ✓ | ✗ (view only) |
| Create / edit / receive purchases | ✓ | ✓ (own site) |
| Issue stock to assets, reverse issues | ✓ | ✓ (own site) |
| Stock adjustments | ✓ | ✓ (own site) |
| **Stock transfers** | ✓ | **✗** |
| View stock balances and history | ✓ (all sites) | ✓ (own site) |

### Database Tables
`item_categories`, `units_of_measure`, `items`, `suppliers`, `storage_locations`, `purchases`, `purchase_items`, `inventory_transactions`, `stock_balances`, `stock_batches`, `stock_batch_movements`, `asset_issues`, `asset_issue_items`, `issue_reversals`, `issue_reversal_items`, `stock_adjustments`, `stock_adjustment_items`, `stock_transfers`, `stock_transfer_items` — all tenant-scoped with `tenant_id`.

### Navigation
Sidebar section **Inventory**: Item Catalog, Stock Movements (purchases, issues, adjustments, and transfers for Admin), Stock (Stock Balances, Transaction History).
