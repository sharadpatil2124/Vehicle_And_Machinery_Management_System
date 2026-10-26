# VMMS — Phase-Wise Development Plan

> **Working companion to `VMMS_Master_Specification (1).md`.**
> The spec is the source of truth for *what* to build. This file is the source of truth for
> *what order* to build it in and *what is done so far*.
>
> **Rule of engagement:** when a phase is requested, implement **only** that phase.
> Do not start later phases. Do not touch unrelated functionality unless strictly required.
> Finish it, verify it works, then stop and wait.

**This project starts from scratch.** No code exists yet. Nothing in this plan may be
assumed to be already built — every phase below, including Phase 0.5, begins from nothing.

**Stack:** React 19 + Vite + **Tailwind CSS** / Node + Express (CommonJS) / MySQL 8 via
**Sequelize**. The spec offers Prisma or Sequelize (§3) — **Sequelize is the choice**.
Do not mix the two.

---

## Organization & Account Structure

This supersedes spec §5 and the membership parts of §24. It is the single most important
structural rule in the system after the KM-vs-hours rule, and it constrains every phase.

```
One Organization  →  exactly one Admin      (the primary account)
                  →  exactly one Supervisor (created by that Admin)
```

- **An account belongs to exactly one organization.** There is no cross-organization
  membership and no account sharing. A person who needs access to two organizations needs
  two separate accounts with two separate email addresses.
- **An Admin or Supervisor from one organization is never duplicated or reused in another.**
  Email is globally unique, so the same login cannot appear in two organizations.
- **The Admin is the primary account.** It is created by sign-up, which also creates the
  organization. Only the Admin can create or manage that organization's Supervisor.
- **The Supervisor belongs only to its own organization** and can never see, reach or affect
  another organization's data.
- **Authentication resolves the organization.** Login finds the account by email, and the
  organization and role come from that account row — never from anything the client sends.

**Enforced in the database, not only in code:**

```
users:  UNIQUE (email)              -- one account, one identity, one organization
        UNIQUE (tenant_id, role)    -- at most one admin and one supervisor per organization
        tenant_id NOT NULL, FK      -- every account is owned by exactly one organization
```

Every other rule from the spec still applies: the Admin may create, view, edit and delete;
the Supervisor may create, view and edit but never delete and never export (§8, §9).

---

## Development Standards

These apply to every phase and override anything below that conflicts with them.

**Production code, written by hand.**
Write what a professional developer would write for a system that is going to run in
production. No sample data, no placeholder implementations, no scaffolding left behind, no
"TODO: implement". If something is in the codebase, it works and it is used.

**Simple over clever.**
Clean, well-structured, readable, maintainable. Solve the problem in front of you at the
altitude the spec asks for — no speculative abstraction, no configuration nobody needs, no
layers added "in case". Consistency across modules matters more than local cleverness.

**Tailwind CSS for all frontend styling.**
Every screen, component and layout is styled with Tailwind utility classes. No hand-written
CSS files, no CSS modules, no styled-components, no inline `style` objects for anything
Tailwind can express. Shared visual patterns become **React components** (a `<Button>`, a
`<Table>`, a `<Badge>`) that own their utility classes internally — that is the reuse
mechanism, not a stylesheet. The Tailwind theme carries the colour, spacing and typography
scale, so tokens live in the Tailwind config rather than in CSS custom properties. The one
exception is the print stylesheet in Phase 12, where print rules that Tailwind cannot
express may live in a small dedicated file.

**No test files in the codebase.**
Do not create `tests/` directories, `*.test.js` / `*.spec.js` files, test fixtures, factories,
or test-runner configuration. Do not add Jest, Supertest, Vitest or React Testing Library as
dependencies.

**Verification is still mandatory — it just does not live in the repo.**
A phase is not complete until its behaviour has been observed working. Verify by actually
running the thing: boot the API and drive the real endpoints, run the app and use the real
screens, query the database directly to confirm what was written, check the build and the
linter. Where a throwaway script is the practical way to exercise something, write it in the
scratchpad directory outside the project and delete it after — never inside `client/` or
`server/`. Report what was verified and what the output was; never claim something works
without having seen it work.

**Built to deploy.**
From the first phase: all configuration through environment variables with a complete
`.env.example` and no secrets in source or in git; schema changes only through committed,
reversible migrations; a production start path distinct from the dev one; structured server
logging with no secrets or tokens in the output; correct HTTP status codes and no stack
traces leaked to clients; security headers, rate limiting on auth, and input validation on
every write; a documented build, run and deploy procedure in the README.

> **One noted deviation from the specification.** Spec §3, §30, §35 and §36 all require an
> automated test suite, including a dedicated tenant-isolation and RBAC suite. That is
> deliberately not being built, at the client's explicit instruction. The trade-off is real
> and worth recording: multi-tenant isolation and role enforcement are exactly the kind of
> rules that break silently during a later refactor, and there will be no automated guard
> against that. Verification per phase is manual and thorough instead. Nothing in the
> architecture prevents a suite being added later if that decision changes.

---

## How to update this file

At the end of every phase, change that phase's `Status:` line and tick its exit criteria.
This is the first file to read at the start of a new session.

Status values: `NOT STARTED` · `IN PROGRESS` · `DONE`

---

## Phase Index

| # | Phase | Depends on | Size | Status |
|---|-------|-----------|------|--------|
| 0.5 | Project Setup & Foundation — fresh start | — | M | DONE |
| 1 | Authentication & User Management | 0.5 | M | DONE |
| 2 | Asset Foundation (shared, backend-only) | 1 | S | DONE |
| 3 | Vehicles (KM-based) | 2 | L | DONE (backend verified live; frontend un-browser-tested) |
| 4 | Machinery (hours-based) | 3 | M | DONE |
| 5 | Sites / Projects & Assignments | 4 | M | PARTIAL — direct site field only, pulled forward; see addendum |
| 6 | Maintenance (preventive + breakdown) | 5 | L | DONE — see "As built" in Phase 6 |
| 7 | Record Service & Parts Consumed | 6 | M | NOT STARTED |
| 8 | Tyre Management | 3 | M | DONE — see "As built" in Phase 8 |
| 9 | Fuel Tracking & Cost Calculation | 4 | M | DONE — see "As built" in Phase 9 |
| 10 | Compliance & Document Expiry | 4 | M | DONE — see "As built" in Phase 10 |
| 11 | Dashboard | 6, 9, 10 | M | NOT STARTED |
| 12 | Reports Hub (view + print) | 11 | L | NOT STARTED |
| 13 | Report Export (Excel/PDF, admin-only) | 12 | S | NOT STARTED |
| 14 | Attachments & Audit History Views | 10 | M | NOT STARTED |
| 15 | Excel Migration Tooling | 14 | M | NOT STARTED |
| 16 | Hardening, Security Review, Deployment & Docs | all | M | NOT STARTED |
| 17 | Inventory & Stock Management | 5 | L | DONE — added outside the original sequence; see Phase 17 |

**Completed modules added since this plan was written:** Phase 9 (Fuel Tracking & Cost
Calculation) is complete, built around the client's real collect → receive → issue workflow
— see Phase 9's "As built". Phase 17 (Inventory & Stock Management) was not in the spec's
original phase list; it was added at the client's request and is complete — see Phase 17 at
the end of this file and `VMMS_Master_Specification (1).md` §37. All other phase statuses
above are unchanged.

**Mapping to spec §31:** this plan splits the spec's Phase 6 into 6 + 7 (maintenance vs.
record-service), splits Phase 11 into 12 + 13 (view/print vs. admin export), and splits
Phase 12 into 14 + 15 (attachments/audit vs. Excel migration) — so each phase stays small
enough to finish, test and demonstrate in one sitting. Everything else keeps the spec's
ordering and intent. The foundation phase is numbered 0.5 so the module phases line up with
the spec's own numbering; it is the **first** phase to run.

**Definition of Done — applies to EVERY phase (§35):**

```
UI + Frontend validation + API + Backend validation + DB model + Migration
  + Business logic + Error handling + Loading/empty/error states
  + Tenant scoping + Role checks + Audit logging + Verified working + Docs
```

---

## Phase 0.5 — Project Setup & Foundation (fresh start)

**Status:** DONE

**Goal:** create the entire project from an empty folder. By the end of this phase there is a
running React app, a running Express API, a migrated MySQL schema, the multi-tenant + RBAC
core and the design-system primitives — with the auth chain observed returning 401, 403 and
200 against a real request.

Multi-tenancy and RBAC are built into the foundation here, **not retrofitted later** (§31).

### Decisions to make before writing code

Settle these three at the start of this phase — each is far cheaper to choose now than to
change once module tables exist:

1. **Account model — no `tenant_members` join table.** Spec §5 and §24 model users and
   tenants as many-to-many through `tenant_members`, because the spec allowed one identity to
   hold roles in several organizations. The organization structure above removes that: the
   relationship is now strictly one organization to one admin and one supervisor. A join
   table exists to express many-to-many; keeping one here would be modelling a relationship
   that cannot occur.

   **Decision: put `tenant_id` and `role` directly on `users`, and drop `tenant_members`.**
   It is simpler, it is one fewer join on the hot authentication path, and — the real
   argument — it lets the database enforce the rule outright with
   `UNIQUE (tenant_id, role)`. In the join-table version that constraint is awkward and
   easy to bypass in application code.

2. **Database column naming.** Spec §24 shows `snake_case` columns mapped to camelCase in
   code. Sequelize can do this with `underscored: true` on every model. Decide now and apply
   it uniformly — retrofitting it after the asset tables land means migrating every table.
3. **Asset modelling.** Two separate tables (`vehicles`, `machinery`) with an
   `asset_type` + `asset_id` pair on every referencing row, per §24's recommendation.
   Document the choice.
4. **Migration runner.** **umzug** — programmatic, reuses the app's own Sequelize instance
   and env loading, nothing extra to configure.
5. **Replacing a Supervisor.** `UNIQUE (tenant_id, role)` means the supervisor slot holds one
   row for the life of the organization. To hand the role to a different person the Admin
   **edits** the existing supervisor account — new name and email, which re-issues a
   set-password link — rather than deleting and recreating. Deactivating keeps the row and
   the slot, so a deactivated supervisor is reactivated rather than replaced. This keeps the
   constraint absolute and avoids a soft-deleted row blocking the slot forever.

### Build — repository and tooling

- `server/` (Node + Express, CommonJS) and `client/` (React 19 + Vite) side by side.
- `.gitignore` for both; `.env.example` for both; a README with setup, run, build and
  deploy instructions. Never commit `.env` or any real secret (§27).

### Build — backend foundation

- `config/env.js` — env loading with validation that **fails fast** on a missing required
  variable, so a misconfigured server never boots half-working.
- `config/database.js` — Sequelize + MySQL with connection pooling, SSL configurable for a
  managed production database, and query logging on in development only.
- `config/migrator.js`, `migrations/`, `scripts/migrate.js` with `migrate`, `migrate:undo`
  and `migrate:status`. The baseline migration creates `tenants`, `users`, `audit_logs` and
  `password_reset_tokens` in foreign-key order, carrying `users.tenant_id`,
  `UNIQUE (email)` and `UNIQUE (tenant_id, role)`.
  - **Do not use `sequelize.sync()` for schema evolution.** It creates missing tables but
    silently ignores changes to existing ones, so a new column appears in the model and never
    in the database. All schema change goes through migrations (§28).
  - Build the migration glob so it works on Windows — a path joined with `path.join` produces
    backslashes, which the glob matcher reads as escape characters and then matches nothing,
    reporting "already up to date" having found zero files. Treat "zero migrations
    discovered" as an error, never as success.
- **Split `app.js` from `server.js`.** `app.js` builds and exports the Express app;
  `server.js` connects, verifies no migration is pending, and listens. Standard Express
  structure: it keeps process concerns out of the app definition, and it is what lets a
  platform or process manager control startup in production.
- Central error handler emitting the spec envelope **`{ error }`** (§25) with correct status
  codes, mapping `AppError` automatically, translating Sequelize unique/FK/validation
  failures, and keeping 500s generic so no stack trace or driver message reaches the client.
  Successes return **`{ data, message }`**. Plus `AppError` and `asyncHandler` so controllers
  stay thin (§30) and never hand-roll `try/catch`.
- Models: `Tenant`, `User` (carrying `tenantId` and `role`, with `UNIQUE (email)` and
  `UNIQUE (tenantId, role)`), `AuditLog`, `PasswordResetToken`, and an `archivable` concern
  supplying the soft-delete columns the asset models will share (§15). **No `TenantMember`
  model** — see decision 1.
- `config/permissions.js` — the complete matrix from §9 as the single source of truth.
- Middleware: `extractTenantAndRole`, `checkRole`, `protectAdminRoute`,
  `protectSupervisorRoute`.
  - **`role` and `tenantId` must be read from the user row loaded from the database, never
    from the token payload.** Trusting the token's claims means a deactivated or changed
    account keeps its old privileges until that token expires — up to a full token lifetime
    of stale access. The token proves identity; the database is the authority on the current
    organization and role (§7).
  - The middleware also confirms the account is still `active` and its organization is still
    `active`, so suspending an organization takes effect on the very next request.
- Shared helpers the asset modules will build on: `tenantScopedRepository` factory (no method
  can run without a `tenantId`), `queryOptions` (pagination clamps, allowlisted sort and
  filter fields, search that ANDs with the tenant scope), `deleteConfirmation`,
  `audit.service`, `archive.service`.
- CORS restricted to `CLIENT_URL` rather than left open to any origin.
- A temporary protected route used only to verify the middleware chain during this phase.
  It is removed at the end of the phase — nothing scaffolding-shaped is left in the codebase.

### Build — frontend foundation

- Vite + React with **every dependency declared in `package.json`** — an undeclared package
  works locally and breaks the first clean install.
- **Tailwind CSS** installed through its Vite plugin, with the theme carrying the project's
  colour, spacing and typography scale. One stylesheet exists solely to pull in Tailwind and
  declare the theme; it is imported by the entry module.
  - **Confirm Tailwind is actually processing before building anything on top of it** — a
    misconfigured content path or a missing import produces a fully working, completely
    unstyled app, and every screen after it inherits the problem.
- The design-system primitives (§26) as **React components owning their utility classes**:
  Button, Field, Input, Select, DatePicker, Card, Badge/StatusBadge, Table, Pagination,
  Modal, ToastProvider, loading / empty / error states, AuthCard. Professional
  industrial/enterprise language — clarity and data density, not decoration. Every module
  page after this phase builds from these components rather than repeating raw utility
  strings, so the visual language stays consistent and a change lands in one place.
- Contexts: `AuthContext`, `TenantContext`, `RoleContext` + `can()`.
- Guards: `ProtectedRoute` (route level) and `ProtectedElement` (control level).
- Shell: `AdminShell`, `Sidebar` carrying the full navigation tree from §26, `Header` with
  the role badge, and a responsive sidebar drawer.
- API client attaching the JWT to every request and clearing the session on a 401, plus
  session storage.
- **`App.jsx` wired with the full route table from the start**: public `/login`, `/signup`;
  `AdminShell` + `ProtectedRoute` wrapping the authenticated routes; `/` redirect;
  `*` catch-all.
- Pin the dev server port and fail loudly if it is taken. CORS is restricted to one origin,
  so a silently drifted port loads the app fine while blocking every API call in the browser.

### Verification

Driven against the running API and the running app. No test files are added to either
project.

- **Auth chain** — with real requests: no token → **401**; malformed header → 401; token
  signed with the wrong secret → 401; expired token → 401; deactivated membership → 401 on
  the very next request; supervisor on an admin-only route → **403**; a token carrying a
  forged `admin` claim over a supervisor membership → **403**, not 200; correct tenant and
  role → **200**, with the tenant taken from the token and not from the query string.
- **Permissions** — walk `hasPermission` across both roles for every resource and action and
  confirm it matches the §9 matrix, particularly that delete is admin-only everywhere and
  report export is admin-only.
- **Query options** — confirm the tenant filter is always present and cannot be overridden
  from the query string, the sort allowlist rejects an unknown field, and pagination clamps.
- **Delete word** — confirm `delete`, ` DELETE `, empty and missing are all rejected and only
  the exact `DELETE` passes.
- **Frontend** — in the browser: every route reachable, a protected route redirects when
  signed out, the session survives a reload, logout returns to login, and admin-only
  navigation is absent for a supervisor.
- **Database** — query MySQL directly after a sign-up to confirm the organization and user
  rows are as expected and the founder's role is `admin`.
- **Organization structure, at the database level** — attempt each of these directly in SQL
  and confirm the database itself refuses: a second `admin` row for one organization, a
  second `supervisor` row for one organization, and the same email in two organizations.
  These must fail on a constraint, not merely be blocked by application code.
- **Styling** — confirm Tailwind is compiling and the shell renders styled, not as unstyled
  markup.

### Exit criteria

- [x] `npm run migrate` applies the baseline cleanly to an empty database
- [x] `npm run dev` boots the API clean, and refuses to boot when a migration is pending
- [x] The client dev server runs on its pinned port; visiting `/` lands on `/login`
- [x] Sign-up creates an organization and its Admin, then lands on `/dashboard` with shell,
      sidebar and role badge rendered and **styled by Tailwind**
- [x] The database refuses a second admin, a second supervisor, or a duplicate email across
      organizations — on a constraint, not just in application code
- [x] Reload keeps the session; logout returns to `/login`
- [x] The auth chain returns 401 / 403 / 200 exactly as listed above, observed live
- [x] A failing API call surfaces its real message, not "Request failed (500)"
- [x] A clean `npm install` followed by `npm run build` succeeds in `client/`
- [x] No linter is configured in either project — nothing to fail; not treated as a gap since
      none was ever wired up
- [x] `.env.example` complete for both apps; no secret in source and none committed
- [x] No `tests/` directory, no `*.test.*` file, and no test-runner dependency in either
      `package.json`

---

## Phase 1 — Authentication & User Management

**Status:** DONE

**Goal:** every way a person gets into the system, and the Admin's management of that
organization's single Supervisor — built end to end, backend and UI.

**Backend**
- `POST /auth/signup` — creates the organization and its **Admin** in one transaction, and
  is the only way an organization comes into existence. Generates the `tenantId`, sets
  `primaryAdminId`, returns a JWT (§10). Sign-up never creates a supervisor and never joins
  an existing organization.
- `POST /auth/login` — verifies the password with bcrypt, loads the account's organization
  and role from its own row, rejects an inactive account or a suspended organization,
  updates `lastLoginAt`, issues a JWT carrying `tenantId` and `role`.
- `POST /auth/forgot-password` and `POST /auth/reset-password` — single-use, time-limited
  tokens, stored hashed, never issued as plaintext passwords.
- `POST /auth/logout` and `GET /users/me/profile` (§25).
- **Supervisor management, Admin only** — one endpoint set operating on the organization's
  single supervisor slot:
  - `GET  /users` — the organization's two accounts, admin and supervisor
  - `POST /users/supervisor` — create the supervisor; **409 if one already exists**, 409 if
    the email is taken by any account in any organization
  - `PUT  /users/supervisor` — update name/email; changing the email re-issues a
    set-password link, which is also how the role is handed to a different person
  - `PATCH /users/supervisor/status` — deactivate or reactivate
  - No change-role endpoint exists. The two roles are fixed and one of each — there is
    nothing to change a role to.
- Every mutation audited and transactional. Audit login, logout, password reset, supervisor
  creation, supervisor update and status change.

**Frontend**
- Login and Signup pages. Sign-up is explicitly "create your organization" — it creates the
  Admin, and the copy says so, so nobody expects to join an existing organization here.
- Forgot-password page showing the same neutral confirmation whichever email is entered.
- Reset-password page reading `?token=`, with a confirm-password field and clear handling of
  an expired or already-used token. The same route serves the supervisor's set-password link.
- **Organization Users page (admin only)** — shows the two accounts: the Admin (the signed-in
  user, marked as the primary account) and the Supervisor. No table pagination or search is
  needed for two rows; a clear two-card or two-row layout reads better and is honest about
  the structure.
  - When no supervisor exists yet: an empty state with a single **Create Supervisor** action.
  - When one exists: their name, email, status and last login, with **Edit** and
    **Deactivate / Reactivate**.
- Create/Edit Supervisor form — name and email — surfacing the 409 cases inline: an email
  already used by another account, or a supervisor that already exists.
- Deactivate confirmation. The Admin's own row offers no deactivate control at all —
  it prevents locking the organization out of its own primary account.
- `Administration → Users` in the sidebar behind `ProtectedElement roles={['admin']}`.
- Header account menu: name, email, role badge, logout.

**Business rules to honour**
- The founder of a new organization is always `admin`, and sign-up is the only way an
  organization is created (§10)
- **One admin and one supervisor per organization**, enforced by `UNIQUE (tenant_id, role)`
- **One account, one organization** — email is globally unique, so a login can never exist in
  two organizations
- Login errors are always the generic "Invalid email or password" (§7)
- Forgot-password never reveals whether an email exists (§10)
- Reset tokens are single-use and time-limited (§10)
- The Admin cannot deactivate itself — prevents lockout (§27)
- A suspended organization blocks login and every subsequent request from both its accounts

**Verification** — driven against the running app, no test files added
- API: signup creates the organization and its admin; a second signup with the same email →
  409; a bad password → 401 with the identical message an unknown email produces; supervisor
  on `/api/users` → 403; admin deactivating itself → 403; reset token reuse → 400.
- Structure: creating a second supervisor → **409**; creating a supervisor with an email that
  exists in a different organization → **409**; both refused by the database constraint, not
  only by application code.
- Isolation: organization A's admin cannot see, edit or deactivate organization B's
  supervisor — by id, by email, or by any request shape.
- Frontend: login validation, the create-supervisor flow, and the Users page absent for a
  supervisor.

**Exit criteria**
- [x] Admin signs up, creates the organization's Supervisor, supervisor receives the
      set-password link (console in dev)
- [x] Supervisor sets a password and logs in with the correct organization and role
- [x] Attempting a second Supervisor is refused with 409
- [x] Supervisor sees no Administration section; `GET /users` returns 403 for them
- [x] Admin edits the Supervisor and deactivates them; both audited
- [x] A deactivated account's existing token stops working on the next request
- [x] Forgot and reset password work end to end
- [x] Two separately-registered organizations cannot see each other's accounts or data, and
      the same email cannot exist in both

---

## Phase 2 — Asset Foundation (backend-only)

**Status:** DONE

**Goal:** build the shared asset machinery and prove it correct **before** two modules depend
on it. **No UI in this phase** — it is verified by exercising the helpers directly against
the running system. Short phase; can run back to back with Phase 3.

**Backend**
- `archiveEntity()` — the archive-instead-of-delete flow written once (§15): verify the
  DELETE word, tenant-scoped lookup, dependency check, then flip status and write the audit
  row in a single transaction. Every module that "deletes" something uses this.
- `audit.service` with `snapshot`, `recordCreate`, `recordUpdate` and `recordArchive`, so
  every module logs changes identically (§27) and every audit row commits or rolls back with
  the change it describes.
- Shared `assetType` enum (`VEHICLE` | `MACHINERY`) plus `resolveAsset(tenantId, assetType,
  assetId)` — the same-tenant guard every later module (maintenance, fuel, service,
  compliance, assignments) uses to reach an asset through the `asset_type` + `asset_id`
  pair (§24).
- `assertMeterNotDecreasing(current, incoming, unit)` — one guard used by vehicles for KM and
  machinery for hours. Same rule, different unit, never mixed (§2).
- A standard list-response builder so every module returns the same `{ data, pagination }`
  shape.
- `createTenantScopedRepository(model)` — the data-access wrapper Phase 3's vehicle repository
  (and every module after it) builds on; no method can run without a `tenantId`. Named in this
  phase's own verification list below, so it is built here rather than left for Phase 3 to
  invent ad hoc.

**Verification** — driven against the running app, no test files added
- `archiveEntity`: a wrong confirmation word is rejected **before any database read**;
  a cross-tenant id → 404; an already-archived row → 409; success flips the status and writes
  exactly one audit row, in one transaction.
- `resolveAsset`: rejects a cross-tenant lookup and a mismatched asset type.
- `assertMeterNotDecreasing`: equal is allowed, lower is rejected, non-numeric is rejected.
- `tenantScopedRepository`: no method can read or write without a `tenantId`.

**Exit criteria**
- [x] Every shared helper has unit coverage and passes — 25/25 checks, driven against a real
      MySQL connection via a throwaway scratchpad script (deleted after the run; nothing it
      created was left behind — verified separately)
- [x] `archiveEntity()` is observed working end to end against a real record: wrong
      confirmation rejected before any query ran, cross-tenant id → 404, success flips
      `status` and writes exactly one audit row in one transaction, already-archived → 409,
      and a `dependencyCheck` hook blocking the archive leaves the record untouched
- [x] No UI change, no new routes, nothing outside this phase touched

---

## Phase 3 — Vehicles (KM-based)

**Status:** DONE (backend fully verified live; frontend built and compiles clean,
but not driven in an actual browser — no headless-browser tool was available in
this environment. Recommend a quick manual click-through before relying on it.)

**Goal:** the first complete vertical slice. Everything after this mirrors its shape.

> **Deviations from spec §11/§12, added after this phase first shipped, at the client's
> explicit instruction:**
> - **No `category` field.** Removed entirely — model, migration (`0004`, dropping the
>   column `0003` created), service validation, list filter, and every frontend field,
>   filter and detail row. Only `type` classifies a vehicle now. Machinery (Phase 4) will
>   not carry a `category` field either, for the same reason.
> - **`assetId` is system-generated, not user-entered.** Sequential per tenant,
>   `VEH-000001` style, assigned server-side in `createVehicle` (counts every vehicle ever
>   created for the tenant, archived included, so an id is never reused) and immutable —
>   never accepted from the client on create or update. The Asset ID field was removed from
>   the create/edit form entirely; it still displays on the list and detail views.

**Backend**
- `Vehicle` model + migration. Fields per §11/§12 minus `category` (see deviation above):
  `assetId` (system-generated), `registrationNumber`, `type`, `modelNumber`,
  `chassisNumber`, `year`, `fuelType`, `currentKM`, `nextServiceKM`, `serviceIntervalKM`,
  `currentSiteId` (nullable until Phase 5), plus the archivable fields and
  `createdBy`/`updatedBy`.
- Composite uniques: `(tenant_id, asset_id)`, `(tenant_id, registration_number)` (§11).
  Indexes: `(tenant_id, status)`, `(tenant_id, created_at)`.
- Repository via `createTenantScopedRepository`. Searchable: `assetId`,
  `registrationNumber`, `modelNumber`. Filters: `status`, `fuelType`.
- Service: per-tenant uniqueness check → 409; KM monotonicity on update;
  `isServiceDue = currentKM >= nextServiceKM`.
- Routes: `POST` / `GET` / `GET /:id` / `PUT` — both roles.
  `DELETE /:id` — **admin only**, requires `{ confirmation: "DELETE" }` (§15).
  `GET /:id/history` — audit trail, both roles.
- Controller re-checks `hasPermission(role, 'VEHICLE', action)` on every mutation (§7).

**Frontend**
- `VehiclesListPage` — table with search, status/fuel-type filters, sort, pagination.
  Service-due rows badged. Loading / empty / error states (§26).
- `VehicleFormPage` (create + edit) — client validation mirroring the server rules.
- `VehicleDetailPage` — summary card only. The "more about this vehicle" stub for
  maintenance/fuel/tyres/compliance was removed at the client's request — nothing about
  those modules is shown until they actually exist.
- **`DeleteWordModal`** — reusable: shows the asset identity, requires typing `DELETE`
  exactly (case-sensitive), confirm button disabled until it matches (§15).
  Rendered inside `ProtectedElement roles={['admin']}`.
- Wire `Asset Management → Vehicles` in the sidebar.

**Business rules**
- Registration number unique **per tenant** — the same plate may exist in another org (§11)
- `currentKM` never decreases (§12)
- Delete archives (`status='archived'`), never a SQL `DELETE` (§15)
- Cross-tenant read by id → **404**, never 403 (§6)

**Verification** — driven against the running app, no test files added
- API: create as supervisor → 201; duplicate registration in same tenant → 409;
  same registration in a *different* tenant → 201; supervisor `DELETE` → 403;
  admin `DELETE` without confirmation → 400; with `"delete"` lowercase → 400;
  with `"DELETE"` → 200 + archived + audit row; tenant A reading tenant B's vehicle → 404;
  KM update lower than current → 400.
- Frontend: the DELETE-word modal keeps confirm disabled until an exact match; the delete
  button is absent for supervisors.

**Exit criteria**
- [x] Supervisor creates and edits a vehicle; delete control is not rendered for them
      (`<Can resource="VEHICLE" action="DELETE">` — verified server-side; not click-tested in a browser)
- [x] Raw `DELETE` as supervisor returns 403 — verified live
- [x] Admin deletes only after typing `DELETE`; vehicle disappears from the list but the
      row still exists with `status='archived'` and an audit entry — verified live
- [x] Search/filter/sort/pagination all work and stay tenant-scoped — verified live
- [x] Cross-tenant vehicle id returns 404 — verified live
- [x] Backend verification: 37/37 checks passed against the running API (throwaway script,
      deleted after the run) — create/duplicate/RBAC/DELETE-word/isolation/meter-monotonicity/
      service-due/search/filter/sort/pagination/audit-history, all against two real
      organizations created through the real signup flow
- [~] Frontend: builds clean (`npm run build`, 0 errors) and the dev server serves it; not
      exercised in an actual browser — no headless-browser automation tool (chromium-cli,
      cached Playwright) was available in this environment and installing one live timed out.
      **Recommend clicking through the flow once manually before trusting the UI half of this
      phase.**

### Addendum — Vehicle documents (added after Phase 3, at the client's request)

Not part of the original plan; pulled forward from what §11/§20/§28 sketch for compliance
documents and attachments, scoped tightly to vehicles: RC and PUC (mandatory), National Permit
and Insurance (optional — relabelled from an earlier RC/PUC/Insurance-mandatory split at the
client's request), one current file per (tenant, vehicle, docType) — uploading again replaces
it rather than adding a second row, since versioned document history was not asked for. No
expiry-date tracking (that is the real Phase 10) — this is upload/download only.

- **Backend**: `vehicle_documents` table (migration `0005`), `VehicleDocument` model,
  `services/storage.service.js` (a small local-disk driver — files live under
  `server/storage/vehicle-documents/<tenant>/<vehicle>/`, outside anything statically served,
  reachable only through the authenticated download route), `services/vehicleDocument.service.js`,
  `middleware/upload.js` (multer, memory storage, PDF/JPG/PNG only, 10MB cap — both configurable
  via `UPLOAD_DIR` / `MAX_UPLOAD_SIZE_MB`). New `DOCUMENT` permission resource (`CREATE`/`READ`,
  both roles — no delete endpoint). Routes nested under `/api/vehicles/:vehicleId/documents`.
  A replace writes the new file, then only deletes the old one **after** the database
  transaction commits — a failure at either the write or the commit step leaves a consistent
  state, never an orphaned file or a dangling row.
- **Frontend**: a "Documents" card on `VehicleDetailPage` — one row per document type showing
  Required/Optional and Uploaded/Missing badges, an Upload-or-Replace file picker, and a
  Download button. `vehicleDocumentsApi` in `api/client.js` bypasses the generic JSON `request()`
  helper for these two calls (multipart upload; blob-response download triggering a client-side
  save).
- **Verified live**: 26/26 checks — upload/replace/download round-trip with byte-for-byte
  content verified, replacing a document keeps the same row (`UNIQUE(tenant_id, vehicle_id,
  doc_type)`) and deletes the old file from disk (checked directly against the filesystem),
  invalid doc type → 400, missing file → 400, disallowed MIME type → 400, oversized file → 400
  with a clean message (not multer's raw error), cross-tenant upload and download → 404. All
  test organizations, vehicles and uploaded files created during verification were deleted
  afterward (DB rows and the on-disk files both), consistent with keeping only real data in
  the database.
- Not browser-tested, for the same reason as the rest of Phase 3's frontend — no headless
  browser available in this environment.

**Update — RC/PUC made mandatory at creation, atomically (client's request)**

Uploading RC and PUC is no longer just offered on the create form — a vehicle cannot exist
without both. `POST /api/vehicles` changed from JSON to `multipart/form-data`: the vehicle's
fields and its RC/PUC files (National Permit/Insurance still optional) travel in one request,
and `vehicle.service.js#createVehicle` validates both are present *before* touching the
database, then creates the vehicle row and every provided document row inside a single
transaction — if any part fails, the whole thing rolls back and no vehicle is left behind, so
the requirement cannot be bypassed by calling the API directly with the field omitted. Any
document files already written to disk in a failed attempt are cleaned up in the `catch`. The
old two-step "create vehicle, then upload documents, then warn on the detail page if one
failed" flow is gone along with the partial-failure banner it needed — creation is now all-
or-nothing. `PUT /api/vehicles/:id` (edit) is untouched: still JSON, still no documents.
Frontend: `VehicleFormPage` blocks submission client-side and marks the RC/PUC rows red with
"This document is required" until both are attached, then sends everything as one
`vehiclesApi.create(payload, files)` call.

Verified live — 21/21 checks (throwaway signup, deleted after the run): missing RC, missing
PUC, and missing both all rejected with 400 and a message naming exactly what's missing;
confirmed no vehicle row exists after any of the three rejected attempts; RC+PUC-only creation
succeeds with National Permit/Insurance correctly left "not uploaded"; RC+PUC+National Permit
creation succeeds with all three uploaded and Insurance still empty; an oversized RC (>10MB)
rejects the entire request, not just that file; the existing JSON `PUT` update path still
works unchanged.

**Update — `type` restricted to Light Vehicle / Heavy Vehicle (client's request)**

`type` is no longer free text — exactly two values, enforced at the service layer (not a
database `ENUM`/`CHECK`: several vehicles created before this restriction carry other values
like "Pickup", and a real constraint would fail to add against that data, or require silently
rewriting it). The column stays `VARCHAR(100)`; those legacy rows keep displaying exactly as
they are, and editing one of them now requires picking one of the two allowed values before it
saves. Frontend: the Type field became a `<Select>` (`config/vehicleTypes.js`). Verified live:
8/8 backend checks + 9/9 browser checks, including a simulated legacy row (DB-written
non-conforming type) confirmed to neither auto-select nor silently pass validation on edit.

**Update — meter basis follows Light/Heavy Vehicle (client's request)**

A Light Vehicle is KM-based, a Heavy Vehicle is hours-based — one vehicle, one of two mutually
exclusive meter triplets (`currentKM`/`serviceIntervalKM`/`nextServiceKM` or
`currentHours`/`serviceIntervalHours`/`nextServiceHours`), decided by `Vehicle#isHoursBased`
(`type === "Heavy Vehicle"`; anything else, including a legacy type, is KM-based). Migration
`0007` made the KM columns nullable and added the hours columns; no `CHECK` constraint ties
`type` to which triplet is populated, same reasoning as the `type` restriction itself.
Switching a vehicle's type between bases requires a fresh reading for the new meter in the same
request — there is no way to carry a KM reading over as an hours reading, or back. Frontend:
`VehicleFormPage` swaps the KM/Hours fields live as Type changes; `VehicleDetailPage`,
`VehiclesListPage` and `AllAssetsPage` all read `isHoursBased` rather than assuming KM.
Verified live: 36/36 backend checks + 20/20 browser checks (including a real legacy-vehicle
edit defaulting correctly to KM fields).

**Update — `fuelType` restricted to Diesel/Petrol/CNG, on both Vehicle and Machinery
(client's request)**

Unlike `type`, every existing row's `fuelType` was already one of these three values, so this
one **is** a real database `ENUM` (migration `0008`) — no legacy-data conflict to work around.
Frontend: `<Select>` in both `VehicleFormPage` and `MachineryFormPage`
(`config/fuelTypes.js`). Verified live as part of the batch below.

**Update — `vehicle_documents` consolidated into a generic `asset_documents` table, and
extended to machinery (client's request)**

RC, PUC, National Permit and Insurance file uploads — until now vehicle-only — moved onto the
same `assetType`+`assetId` pair every other cross-asset module uses (`ComplianceDocument`,
`Site`), replacing the vehicle-specific table entirely rather than adding a parallel
`machinery_documents` one:

- **Migration `0012`** creates `asset_documents` and — since real organizations already had
  real uploaded RC/PUC/etc. — copies every existing `vehicle_documents` row across
  (`asset_type = 'VEHICLE'`, `asset_id` resolved from the vehicle's own business id) before
  dropping the old table. Only metadata moves; `stored_filename` is copied unchanged, so no
  file already on disk needed moving or renaming — confirmed against all 12 real rows across
  3 live organizations, byte-for-byte, before this was considered safe to ship.
- **`AssetDocument` model** (replacing `VehicleDocument`) and **`assetDocument.service.js`**
  (replacing `vehicleDocument.service.js`) — generic list/upload/download, plus
  `getMandatoryDocTypes(assetType)`: RC/PUC stay mandatory for a vehicle (unchanged rule); a
  machine requires none of the four — the client asked only to *allow* uploading while
  creating a machine, not to require it. `storage.service.js#buildKey` now lays new uploads out
  under `<tenant>/<assetType>/<assetId>/...`; a pre-migration file keeps whatever path it
  already had — both resolve correctly, since a stored path is always looked up as-is.
- **Routes moved off `/vehicles/:vehicleId/documents`** onto a generic
  `/api/documents/:assetType/:assetId[/:docType[/download]]`, the same shape `/compliance`
  already uses, mounted once instead of nested under each asset module.
- **Machinery creation switched from JSON to `multipart/form-data`**, mirroring vehicle
  creation exactly (`uploadAssetCreationDocuments`, generalised from
  `uploadVehicleCreationDocuments`), so a machine and any documents attached at creation save
  in one transaction — cleaned up together on failure, same as a vehicle's RC/PUC. Since
  machinery creation is no longer plain JSON, the bundled compliance object (added the
  previous phase) picked up the same JSON-stringify/parse dance the vehicle create path
  already needed for the same reason.
- **Frontend**: `AssetDocumentFields` (the create-form picker) and `AssetDocumentsCard` (the
  detail-page upload/replace/download panel) are shared components used by both
  `VehicleFormPage`/`VehicleDetailPage` and the newly-added `MachineryFormPage`/
  `MachineryDetailPage` sections — one implementation, not two. `config/vehicleDocuments.js`
  was replaced by `config/assetDocuments.js`.

Verified live: 21/21 backend checks (vehicle RC/PUC-mandatory behaviour unchanged, machinery
accepting zero-to-all four documents at creation, upload/replace/download round-trips for both
asset types via the generic route, replacing keeps one row not two, cross-tenant 404s, unknown
asset/doc type → 400) + a direct service-level check streaming one of the real migrated
documents byte-for-byte + 11/11 browser checks (mandatory-doc blocking still fires for a
vehicle, a machine saves with zero or with some documents attached, both detail pages show the
same Documents card working identically). All temporary test data and files were removed
afterward; the 4 real organizations' data and files were confirmed untouched throughout.

**Update — Chassis Number and Registration Number made unique system-wide, across every tenant
and across Vehicles and Machinery combined (client's explicit request)**

Registration Number was already checked for uniqueness on `Vehicle`, but only within the
caller's own tenant, and Chassis Number (`vehicles.chassisNumber` on a vehicle,
`machinery.serialNumber` — labelled "Chassis Number" in the UI only, see the Phase 4 addendum
below — on a machine) had no uniqueness check at all. The client asked for both to become
unique **system-wide**: no two records anywhere, of either asset type, belonging to any tenant,
may share a value — a deliberate, explicit exception to this app's otherwise universal
tenant-scoping rule, confirmed with the client rather than assumed, since it's such a sharp
departure from how every other check in this codebase works.

- **`assetIdentifier.service.js`** (new) — `assertChassisNumberAvailable`/
  `assertRegistrationNumberAvailable` query `Vehicle` and `Machinery` directly, with no
  `tenantId` filter, checking both tables for either field. `vehicle.service.js`'s old,
  tenant-scoped `assertRegistrationAvailable` was removed and replaced by this; the equivalent
  chassis-number check and both machinery-side checks (`serialNumber`, `registrationNumber`)
  are new — none existed before. Both are called before create (when a value was given — only
  the vehicle's registration number is mandatory, everything else stays optional) and before
  update (only when the field is actually changing, the same pattern the old check already
  used), so a request gets a specific, clean 409 before any row is written.
- **Migration `0016`** adds `BEFORE INSERT`/`BEFORE UPDATE` triggers on both `vehicles` and
  `machinery` as a database-level backstop — the client specifically asked that a duplicate be
  impossible even through "manual database operations", which the application-level check above
  cannot protect against on its own, and which a plain `UNIQUE` index cannot express either
  (MySQL has no way to index across two different tables). Each trigger `SIGNAL`s a specific
  error if the incoming value already exists in either table (excluding its own row, on
  update); `errorHandler.js#translateDatabaseError` recognises the signal and turns it into the
  same clean conflict response a normal request would already have gotten from the check above
  — this backstop is only ever actually reached by a raw SQL write or a genuine race between two
  concurrent requests.
- No frontend code changes were needed — both `VehicleFormPage` and `MachineryFormPage` already
  surface any API error via the existing top-of-form alert, which is what displays the new
  conflict messages.

Verified live: 15/15 backend checks (cross-tenant registration/chassis duplicates rejected,
vehicle-vs-machinery duplicates rejected both ways, two machines sharing a chassis number
rejected, the same rejections on the update path, a no-op update to an asset's own unchanged
value still succeeds, two assets both leaving the optional fields blank never conflict with
each other) + a direct raw-SQL test against the database confirming the triggers alone block a
duplicate insert/update with no application involved at all + 5/5 browser checks (creating a
second vehicle with an already-used registration number is rejected with a clear on-form error
and no vehicle is created; the same for a machine reusing a vehicle's chassis number). No
existing data conflicted with the new rule — checked against all 4 real organizations before
the migration was written.

---

## Phase 4 — Machinery (hours-based)

**Status:** DONE

**Goal:** mirror Phase 3 for hours-based assets. **Never reuse vehicle KM logic** (§2, §13).

**Backend**
- `Machinery` model + migration: `assetId` (system-generated, `MCH-000001` style — same
  pattern as Vehicle, see Phase 3's deviation note), `type`, `modelNumber`, `serialNumber`,
  `year`, `fuelType`, `currentHours`, `nextServiceHours`, `serviceIntervalHours`,
  `currentSiteId`, archivable fields. **No `category` field** — same deviation as Vehicle.
  Unique `(tenant_id, asset_id)`. No registration number.
- Service: hours monotonicity; `isServiceDue = currentHours >= nextServiceHours`.
- Routes mirroring vehicles, gated on the `MACHINERY` permission set.

**Frontend**
- Machinery list / form / detail pages. Labels say **Hours**, never KM.
- `All Assets` page — combined view of both, with an asset-type column and filter.
- Wire `Asset Management → Machinery` and `→ All Assets`.

**Verification** — driven against the running app, no test files added
- Hours monotonicity rejects a lower reading; machinery has no KM field anywhere;
  a vehicle service-due calculation is never applied to machinery.
- Same RBAC + DELETE-word + cross-tenant suite as Phase 3.

**Verified live** — 29/29 backend checks against the running API (throwaway scratchpad
script, deleted after the run): create/read/update, hours monotonicity (lower rejected,
equal allowed, higher allowed), `isServiceDue` flips at the threshold, next-service-hours
recalculates only when the interval itself changes, `MCH-000001`-style asset id generation,
DELETE-word (missing/lowercase/exact, already-archived → 409), archived rows excluded from
the default list and included with `?status=archived`, cross-tenant read/update/delete → 404,
audit history returns a `CREATED` entry, validation on missing required fields, no-token →
401, and full supervisor RBAC (create/read/update allowed, delete → 403 — supervisor logged
in for real through the set-password link, not simulated).

Frontend additionally click-tested in a real, headed-equivalent Chrome instance via
Playwright (installed ad hoc in the scratchpad only, never added to `client/package.json`) —
unlike Phase 3, a browser was available this time: signup → create a machine → hours
monotonicity error shown inline → valid update → service-due badge appears once the
threshold is crossed → All Assets combined view shows the machine with an asset-type badge
and the type filter hides it → DELETE-word modal (disabled until exact match) → delete →
machine gone from the default list. 21/21 browser checks passed. This run caught a real bug
before it shipped: `MachineryFormPage` was resending `serviceIntervalHours` on every edit
(inherited from `VehicleFormPage`'s form-always-sends-every-field pattern), which defeated
the backend's "only recalculate the next-service target when the interval itself changes"
guard — every hours update was silently pushing the service target forward. Fixed in
`MachineryFormPage` by tracking the loaded interval and omitting the field from the update
payload unless it actually changed. **Not fixed in `VehicleFormPage`** — that file belongs to
the already-DONE Phase 3 and touching it was out of scope for this phase; the same latent bug
likely still affects vehicles' `nextServiceKM` and is worth a follow-up.

All test organizations created during verification (API script + each browser run) were
deleted afterward, in FK order, inside a transaction — confirmed zero remaining.

**Exit criteria**
- [x] Machinery CRUD works with hours; no KM appears in the model, API, or UI
- [x] `All Assets` lists both types correctly and filters by type
- [x] Full RBAC + DELETE-word + isolation suite green for machinery

---

## Phase 5 — Sites / Projects & Assignments

**Status:** DONE — the assignment-history subsystem below is built (see the addenda below),
plus a dedicated Site Management module the client asked for afterward: a master/detail
workspace to browse a site's assets and transfer one to another site, alongside — not instead
of — the original Site dropdown and per-asset history card.

**Backend**
- `Site` model: name, location, status, dates. (No `siteCode` — removed at the client's
  request from the lightweight version already built; see this section's addendum. A site is
  identified by name.)
- `SiteAssignment`: `assetType` + `assetId`, `siteId`, `assignedAt`, `unassignedAt`,
  `assignedBy`. Index `(tenant_id, asset_type, asset_id, assigned_at)`.
- **Same-tenant validation** before linking site ↔ asset (§21).
- **Overlap prevention:** assigning to a new site closes the previous active assignment —
  both writes in **one transaction** (§21, §24).
- Update the asset's `currentSiteId` in the same transaction.
- `POST /api/sites`, `GET`, `PUT`, `DELETE` (admin + DELETE-word),
  `POST /api/sites/assign`, `POST /api/sites/unassign`, `GET /api/sites/:id/assets`.

**Frontend**
- `SiteMasterPage` (list/create/edit/delete), `AssetAssignmentsPage`
  (assign an asset to a site, see current + historical assignments).
- Assignment history timeline on the asset detail page.

**Exit criteria**
- [x] An asset assigned to site B automatically closes its site-A assignment; history keeps both
- [x] An asset can never be actively assigned to two sites at once
- [x] Assigning a nonexistent or another tenant's site → 400 (not 404 — matches this module's
      existing `assertSiteAssignable` validation-style error, unchanged from the Phase 3/4 addendum)
- [x] Site delete is admin-only with DELETE-word; assignment history survives

**Addendum — direct site field (client's request, pulled forward)**

The client asked only for "a Site field so an Admin can assign a vehicle or machinery asset to
a specific site" — not the assignment-history subsystem above. What was built instead: a
`Site` model/migration (`siteCode`, `name`, `location`, `status` — archivable, same shape as
every other module) and a `sites` CRUD API (`SitesPage`, both roles create/read/update, admin
deletes), plus a foreign key added from `vehicles.current_site_id`/`machinery.current_site_id`
onto `sites.id` (migration `0010` — those columns existed since Phase 3/4 specifically waiting
for this). The Vehicle and Machinery forms gained a "Site" dropdown that sets
`currentSiteId` directly; the detail pages resolve and show the site's name.

**Deliberately not built**: `SiteAssignment`, `assignedAt`/`unassignedAt`, overlap prevention,
`assign`/`unassign` endpoints, and the assignment-history timeline — reassigning an asset
simply overwrites `currentSiteId` with no record of the previous site. That remains the real
Phase 5, should the fuller version be wanted later.

Verified live: 8/8 backend checks (create/duplicate-code/assign/reject-nonexistent-site/
reject-archived-site/clear-assignment) + 6/6 browser checks (site creation, both forms' Site
dropdown populated and wired, detail pages showing the assigned site's name).

**Update — `siteCode` removed entirely (client's request: "I do not need it")**

A site is identified by its name from here on — `siteCode` is gone from the model, the
migration chain (`0013` drops the column and its per-tenant unique constraint; the `sites`
table was empty at the time, so nothing needed migrating), the service layer (no more
duplicate-code check on create/update, search now matches on name only), and the frontend
(`SiteForm`'s field, the list table's column). The two Vehicle/Machinery form's Site dropdown
— which showed `siteCode — name` — now shows `name — location` instead, so it stays useful as
an identifier without the removed field. Nothing else changed: create/edit/archive, the
`currentSiteId` assignment on both asset forms, and the detail pages' site-name display all
work exactly as before.

Verified live: 9/9 backend checks (create without a code, a sent code is silently ignored
rather than rejected, two sites can now share a name, search-by-name, site assignment to a
vehicle, update, archive) + 5/5 browser checks (no Site code field or column anywhere, the
Site dropdown showing name + location).

**Addendum — assignment history built, shaped differently from the section above by explicit
choice**

Two shape decisions were put to the client rather than assumed, since both change the
day-to-day workflow:

- **Assigning still happens through the existing Site dropdown** on the Vehicle/Machinery
  create/edit form — no separate "Assign to Site" action, no `assign`/`unassign` endpoints, no
  `AssetAssignmentsPage`. History is recorded transparently underneath that same dropdown.
- **History is shown on the asset's own detail page**, not a standalone assignments page.

New table `site_assignments` (migration `0015`): `tenantId`, `assetType`+`assetId` (the same
generic pair every other module uses), `siteId`, `assignedAt`, `unassignedAt` (`null` while
active), `assignedBy`. Indexed `(tenant_id, asset_type, asset_id, assigned_at)`, exactly as
originally specified.

`siteAssignment.service.js#recordSiteAssignment` is the one place the invariant lives: given
the site a vehicle/machine had *before* a write and the site it has *after*, it closes the
previously-active row (`unassignedAt = now`) and opens a new one — both inside the same
transaction `vehicle.service.js`/`machinery.service.js` already wrap their create/update in, so
a write can never leave two rows active at once, and a failure rolls back the whole thing
including the assignment change. Saving with the site unchanged is a deliberate no-op (no
redundant history row); clearing the site (`currentSiteId: null`) closes the active row and
opens nothing. Pre-existing assets (created before this migration) start with no history until
their site is next changed — there is no backfill, matching how compliance and documents were
rolled out.

`GET /api/site-assignments/:assetType/:assetId` (its own top-level resource, mirroring
`/api/compliance/:assetType/:assetId` and `/api/documents/:assetType/:assetId` rather than
nesting under `/sites`) returns the full history, most recent first, each row resolved with the
site's name and the assigning user's name. `SiteHistoryCard` — shared by
`VehicleDetailPage`/`MachineryDetailPage`, the same sharing pattern as `AssetDocumentsCard` —
renders it with a "Current" badge on the active row.

`GET /api/sites/:id/assets` was also built (site backend requirement, listed independently of
the two UI questions above) — returns every active vehicle and machine currently at a site. It
has no dedicated frontend surface yet; nothing currently links to it.

Verified live: 26/26 backend checks (history after create, close-and-reopen on reassignment,
no-op on an unchanged site, clearing a site, `GET /api/sites/:id/assets` reflecting the move,
rejecting a nonexistent site, machinery mirroring vehicle behaviour) + 4/4 browser checks (the
"Site history" card appearing on a machine's detail page with a "Current" badge, updating to
show both sites after reassignment through the ordinary edit form).

**Update — dedicated Site Management module added (client's request, supersedes the "keep the
existing dropdown" choice above)**

The client asked for a proper master/detail workspace after all: a `Site Management` sidebar
entry (`/site-management`, `SiteManagementPage`) with a site picker, that site's live asset
count/status, and a two-column layout — every vehicle/machine currently there on the left
(search + type filter, client-side over `GET /api/sites/:id/assets`, which this reuses rather
than adding a new list endpoint), and the selected asset's full details plus its complete
transfer history on the right (`SiteAssetDetailPage`). A `Transfer to another site` button opens
a dialog scoped to sites other than the one currently being viewed; confirming it simply calls
the *existing* `PUT /api/vehicles/:id` / `PUT /api/machinery/:id` with a new `currentSiteId` —
the same call the asset's own edit form already made, so it runs through the identical
`recordSiteAssignment` transaction from the addendum above with no new backend code at all.

This does not replace the Site dropdown on the Vehicle/Machinery form (still there, still
works) — it adds a second, purpose-built place to do the same underlying operation. Transfer
history here is presented differently on purpose: rather than a flat list of assignment
periods, consecutive rows are paired into "Site A → Site B" transfer events (first entry:
"Initially assigned to Site A"), directly answering the client's ask for "the previous site, new
site, transfer date" to read clearly together, computed client-side from the same
`/api/site-assignments/:assetType/:assetId` data.

Verified live: 21/21 browser checks — empty state with no sites, asset counts and both asset
types listed correctly for a site, search and type-filter narrowing the list, transfer history
showing the paired from/to chain, the transfer dialog excluding the current site, a completed
transfer removing the asset from its old site's list and a success notice confirming the move,
the asset then appearing at the new site with its full transfer chain intact, and the existing
Vehicles list / Sites master pages confirmed unaffected.

**Update — `SiteHistoryCard` removed from the Vehicle/Machinery detail pages (client's
request)**

The simpler assignment-list card added to the asset detail pages above is gone — the client
wants full transfer history visible in exactly one place (Site Management) and only the current
site on an asset's own page, which the pre-existing `Current site` detail field already
provides untouched. `SiteHistoryCard.jsx` had no other importer once both usages were removed,
so it was deleted outright rather than left as dead code. `GET /api/site-assignments/:assetType/:assetId`
and the `recordSiteAssignment` transaction it reads from are both untouched — Site Management's
own transfer history (built independently, inline in `SiteAssetDetailPage`) does not use this
component and is unaffected.

Verified live: 8/8 browser checks (no "Site history" section and "Current site" still present
on both a machine's and a vehicle's detail page, the Vehicle detail page's Documents section
confirmed unaffected, and Site Management's transfer history/Transfer button confirmed still
fully intact).

**Update — searchable site picker with a status filter and "View all sites" (client's request)**

The plain `<select>` at the top of Site Management (fine for a handful of sites, unwieldy once
an org has many) is replaced with a `Select a site` dialog: a search box (name/location, 250ms
debounced) and a status filter — the same `Active (default)` / `Archived` two-option pattern
`SitesPage` already uses — both delegating straight to the existing `sitesApi.list({ search,
status })`, so no backend change was needed. A `View all sites` link clears both back to their
defaults in one click. The trigger button in the page header shows the currently-viewed site's
name so it's always visible which site you're looking at without the dialog open. Selecting a
site from the results closes the dialog and drives the exact same `loadSite` call the old
`<select>`'s `onChange` did — only the picking UI changed.

Verified live: 9/9 browser checks (the dialog defaults to active sites only, a search term
narrows results to the matching site, "View all sites" restores the full active list, switching
the status filter to Archived shows only the archived site and hides the active ones, and
picking a site from the results switches the page and closes the dialog).

---

## Phase 6 — Maintenance (preventive + breakdown)

**Status:** DONE — backend and frontend both verified live (see "As built" below)

**Backend**
- `Maintenance` model: `assetType`, `assetId`, `type` (`preventive`|`breakdown`),
  `status` (`reported`|`in_progress`|`resolved`), `reportedDate`, `startedAt`,
  `completedAt`, `description`, `performedBy`, `labourCost`, `totalCost`,
  `downtimeMinutes`, `meterReading`.
- **Downtime** computed from breakdown start → resolution (§16).
- Status-transition guard: only `reported → in_progress → resolved`; no skipping backwards.
- Preventive is scheduled against **KM for vehicles, hours for machinery** — the split is
  enforced, never blurred (§2, §16).
- Routes: create/read/update both roles; delete admin-only.

**Frontend**
- `PreventiveMaintenancePage` — upcoming + overdue, split by asset type with the right unit.
- `BreakdownMaintenancePage` — active breakdowns with live elapsed downtime.
- `MaintenanceHistoryPage` — all records, filterable by asset/type/status/date.
- Maintenance tab on the asset detail page.

**Exit criteria**
- [x] A vehicle's preventive schedule reads in KM; a machine's reads in hours (a Heavy Vehicle
      reads in hours too — the existing Light/Heavy meter-basis rule from Phase 3 is honoured)
- [x] Breakdown downtime accumulates correctly and stops on resolution
- [x] Invalid status transitions are rejected
- [x] Delete is admin-only; records are tenant-scoped (and site-scoped for supervisors)

### As built

**Deviations from the field list above, each deliberate:**
- **Workflow column is `stage`, not `status`.** `stage` holds `reported → in_progress →
  resolved`; `status` keeps the `active | archived` meaning it has on every other table, so
  admin delete archives the row (DELETE-word confirmation, same as fuel transactions) and
  `?status=archived` lists deleted records, consistent with the rest of the app.
- **`reportedAt` is a timestamp, not a date** — downtime is measured to the minute, which a
  date-only column cannot do.
- **`meterReading` + `meterType` (`KM | HOURS`)**, the same pair `fuel_transactions` uses.
  `meterType` is fixed from the asset at creation.
- **`siteId`** is stored (the asset's site at the time it was reported) so supervisors are
  scoped to their own site exactly as with fuel transactions.
- **"Maintenance tab" is a `Maintenance` card** on the Vehicle and Machinery detail pages —
  those pages are stacked cards, not tabs (documents, inventory history), so it follows that
  pattern.

**Backend** — migration `0058-create-maintenance` (reversible; indexes
`(tenant_id, asset_type, asset_id, type)`, `(tenant_id, stage)`, `(tenant_id, completed_at)`,
`(tenant_id, status, reported_at)`), `Maintenance` model, `maintenance.service.js`, routes under
`/api/maintenance`:

```
GET    /api/maintenance                       list — type, stage, open=true, assetType, assetId,
                                              siteId (admin), dateFrom/dateTo, status, search, sort
GET    /api/maintenance/preventive-schedule   every active asset's current vs. next service reading
GET    /api/maintenance/:id
POST   /api/maintenance                       create — always starts at `reported`
PUT    /api/maintenance/:id                   edit details/costs/times; never the stage
POST   /api/maintenance/:id/stage             { stage, at?, meterReading?, performedBy?, costs? }
DELETE /api/maintenance/:id                   admin only, { confirmation: "DELETE" } → archive
```

- **Transitions** go through `/stage` only, one step forward at a time; anything else is a 409
  (skipping `reported → resolved`, going backwards, repeating a stage, touching a deleted
  record). A stage sent through `PUT` is a 400. The record row is locked `FOR UPDATE` during a
  transition.
- **Downtime** (breakdowns only) = `reportedAt → completedAt`, stored in `downtimeMinutes` on
  resolution and recomputed if either time is edited later. While open, the API reports the
  live elapsed minutes; a deleted open breakdown stops counting.
- **Preventive completion** (spec §16) requires a meter reading, rejects one below the asset's
  current reading, writes it to the asset (`currentKM` or `currentHours`, chosen by the asset's
  meter basis), and sets the next service target to reading + interval — in the same
  transaction, with an audit entry on the asset. After that, the record's meter reading is
  locked. A breakdown's meter reading is informational and never touches the asset.
  Phase 7's Record Service is still separate work.
- **One open record per asset per type**: a second open breakdown (or open preventive job) for
  the same asset is a 409. The asset row is locked during create, so concurrent reports cannot
  both get through.
- **Schedule states**: `overdue` (current ≥ next), `due_soon` (within 1,000 KM or 50 hours),
  `ok`. Assets without a service target (a vehicle with no KM interval) are left out.
- Timestamps cannot be in the future (5-minute clock-skew allowance) or out of order.
  `totalCost` cannot be below `labourCost`.

**Frontend** — sidebar `Maintenance` section with three pages:
- `PreventiveMaintenancePage` (`/maintenance/preventive`) — open preventive work (Start /
  Complete / Edit / Delete), then the service schedule split into **Vehicles** and
  **Machinery** cards, each row in its own unit, defaulting to "Overdue and due soon" with an
  "All scheduled assets" view. "Schedule" on a row opens the form preset to that asset.
- `BreakdownMaintenancePage` (`/maintenance/breakdowns`) — open breakdowns with downtime that
  ticks live (every 30s), plus active count / combined downtime / longest-current stats.
- `MaintenanceHistoryPage` (`/maintenance/history`) — every record, filterable by asset type,
  asset, type, stage, site (admin), reported-date range and active/deleted; sortable;
  `?assetType=&assetId=` and `?type=` deep links.
- `MaintenanceHistoryCard` on both asset detail pages, with Schedule preventive / Report
  breakdown buttons; completing a job refreshes the page so the new meter/next-service values
  show at once.
- Shared `components/maintenance/MaintenanceDialogs` (create/edit form, start/complete
  dialog with a live downtime preview and the asset's current reading, DELETE-word delete)
  and `MaintenanceCells`. Client validation mirrors the server rules. Delete controls render
  only for admins.

**Verified live** — against a fresh database built from the repo's migrations (`0001`–`0058`,
plus `0058` down/up), never the dev `vmms` database (see the note below); throwaway scripts in
the scratchpad, deleted afterwards along with the database:
- **85/85 API checks**: KM vs hours on the schedule (Light Vehicle KM, Heavy Vehicle and
  machinery hours, no KM on any machinery row), overdue/due-soon/ok states and ordering;
  validation (missing description, unknown type/asset type, negative or inconsistent costs,
  future/invalid times, unknown asset, non-numeric id); the full transition guard; preventive
  completion updating the asset (hours 230 → next 480; KM 15,600 → next 20,600, hours left
  null); breakdown downtime live at ~90 min, fixed at 75 on resolution and still 75 later,
  recomputed to 80 on edit; one-open-per-asset 409s, including 3 concurrent reports → exactly
  one 201; supervisor site scoping (read/create/stage at another site → 404, list and schedule
  only show their own site); cross-tenant GET/PUT/stage/DELETE → 404 and lists stay separate;
  DELETE-word (supervisor 403, missing/lowercase 400, archive 200, repeat 409, editing a deleted
  record 409); archived asset → 400; no token → 401. Audit rows were confirmed in the database
  for every create/update/archive, plus the asset `UPDATED` entry from preventive completion.
- **37/37 browser checks** (headless Chrome via Playwright, installed in the scratchpad only):
  sidebar, schedule units and states, schedule → start → complete (client blocks a reading
  below the asset's and a total below labour), asset detail showing 520 hrs and the resolved
  job, breakdown reporting from the detail page and the breakdown page with live downtime,
  duplicate-breakdown error shown in the dialog, resolve with downtime preview, history
  filters/edit/DELETE-word delete/deleted view, supervisor sees no Delete controls. The only
  failed HTTP call in the run was the intentional duplicate 409; no console errors.
- `npm run build` clean.

**Update — fuel readings keep the asset meter current (client's request)**

The odometer / hour-meter reading entered on every fuel issue now updates the asset, so
Asset Management and the preventive schedule always reflect the latest reading. Nothing in
Maintenance needed changing — the schedule and service-due flags already read the asset's
`currentKM` / `currentHours`.

- `assetMeter.service.js#settleMeterFromFuel` runs inside the existing fuel create / edit /
  delete transactions, with the asset row locked. Light vehicles update `currentKM`; heavy
  vehicles and machinery update `currentHours`. An entry whose meter type no longer matches
  the asset's basis (after a Light↔Heavy switch) is ignored.
- **Create:** a reading above the asset's raises it. A lower one (a backdated entry) leaves
  the asset alone, so backdated entries still work exactly as before.
- **Edit / delete:** each entry stores the reading it replaced (`asset_meter_before`). If that
  entry is still what the asset reads, an edit or delete rolls the meter back to the highest
  of: that stored reading, other active fuel readings, and completed preventive-service
  readings. A mistyped reading can now be corrected (the asset form refuses to lower a meter,
  so before this it couldn't). A later manual edit or service is never undone.
- The next service target is not touched — it still changes only when the interval changes
  or a preventive service is completed. Every meter change is audit-logged on the asset.
- Migration `0059-sync-asset-meters-from-fuel` adds the column and, once, raises any asset
  whose highest active fuel reading is above its stored meter (audit row with
  `performed_by = NULL`, `asset_meter_before` set so a later delete rolls back cleanly).
  `down` removes the column; raised readings stay. Safe to re-run after a partial failure.
  `0058` also now refuses to run over a pre-existing `maintenance` table, since Sequelize's
  `createTable` is `CREATE TABLE IF NOT EXISTS` and would otherwise silently alter it.

Verified live on a fresh database (throwaway, deleted afterwards): 30/30 API checks, covering
KM and hours, the schedule following raises and rollbacks, backdated entries, typo
correction, manual edits surviving, preventive completion interplay, site-stock and
direct-pump paths (stock reversal unchanged), supervisor entries, Light↔Heavy switch, 3
concurrent fills, and the existing fuel sequence rule and efficiency endpoint unchanged. The
backfill was also tested on simulated legacy data, and `0059` down/up. `npm run build` clean.

**Dev database note:** the local `vmms` database has an orphan `maintenance` table (2 rows of
hand-entered test data) from an earlier abandoned attempt, recorded as applied migration
`0018-create-maintenance` but never committed to git. `0058` creates `maintenance` and so will
fail on that database until the orphan table is renamed or dropped. A database built from the
repo is unaffected. Resolved: the orphan was renamed to `maintenance_orphan_0018` (rows kept)
and `0058` then applied.

---

## Phase 7 — Record Service & Parts Consumed

**Status:** NOT STARTED

**Backend**
- `Service` model + `ServicePart` child table exactly as §17 specifies.
  `service_parts.service_id` FK **`ON DELETE CASCADE`**; `description` is required
  **free text** — deliberately **no** parts catalog, no `part_id` FK.
- `POST /api/services` accepts `partsConsumed[]`; parent + children insert in **one
  transaction** (§17). Edit replaces the part rows transactionally.
- On save: validate the meter reading is non-decreasing, **update the asset's current
  meter**, and for preventive services **recalculate the next service target**
  (current + interval) (§17).
- Delete admin-only.

**Frontend**
- `RecordServiceForm` — date, type, meter reading (labelled KM or Hours by asset type),
  labour, cost, notes.
- **Repeatable parts rows** — manual text input for description (required), optional
  quantity and unit cost, auto-summed line + total. Add / remove row (§17).
- Service history on the asset detail page, parts expandable per service.

**Exit criteria**
- [ ] A service with 3 manually-typed parts saves; all 3 rows persist against the service
- [ ] Saving updates the asset meter and recalculates the next service target
- [ ] A meter reading below the current one is rejected server-side
- [ ] Deleting a service cascades its part rows; the asset is untouched
- [ ] There is no parts dropdown or catalog anywhere

---

## Phase 8 — Tyre Management

**Status:** DONE (backend and frontend) — see "As built" below

**Backend**
- `Tyre` model (`tyreCode` unique per tenant, brand, size, status, purchase info) and
  `TyreAssignment` (vehicleId, position, installedAt, installMeterKM, removedAt,
  removeMeterKM).
- **Position-conflict prevention:** no two active tyres in the same position on one vehicle (§18).
- **Running KM** derived from vehicle KM progression since install.
- `POST /api/tyres`, `POST /api/tyres/:id/install`, `POST /api/tyres/:id/remove`,
  `DELETE /api/tyres/:id` (admin).

**Frontend**
- `TyreMasterPage`, `TyreHistoryPage`, and a tyre-position view on the vehicle detail page.

**Exit criteria**
- [x] Installing a second tyre into an occupied position is rejected
- [x] Running KM tracks the vehicle's odometer since install
- [x] Install/remove history is fully preserved
- [x] Tyres attach to **vehicles only** — never machinery

### As built

- Migrations `0053` (`tyres`) and `0054` (`tyre_assignments`). Tyre codes are auto-numbered
  `TYR-000001`; the serial number is optional but unique per tenant.
- Tyre fields: brand, model/pattern, size, serial number, condition (new/retreaded), purchase
  date/cost/from, notes, the site it is kept at, and a state: **in stock → fitted → scrapped**.
- **Positions** depend on vehicle type: Light Vehicle = front/rear left/right + spare; Heavy
  Vehicle = axle 1 left/right, axles 2–4 left/right outer/inner, 2 spares.
- **Position conflict** is blocked twice: by the service, and by unique indexes on generated
  `active_position` / `active_tyre_id` columns, so two simultaneous fits cannot both succeed.
- **Running** = vehicle's current meter − meter at fitting (or removal − fitting once removed).
  Heavy Vehicles are hours-based, so their tyres run in **hours**, not KM. The fitting/removal
  reading can't be above the vehicle's current meter, and removal can't go below fitting.
- **Remove** records date, reading, reason (puncture, worn out, damaged, retreading, other)
  and outcome (back to stock / scrap). **Rotate** moves a tyre to another position on the same
  vehicle, swapping with the tyre already there. **Scrap** retires an in-stock tyre.
- Site scoping: a tyre off a vehicle belongs to the site it is kept at; a fitted tyre goes
  wherever its vehicle is. Fitting needs the tyre and vehicle at the same site.
- Delete (Admin, type DELETE) archives the tyre; a fitted tyre must be removed first. Restore
  is Admin only.
- API: `/api/tyres` (list, create, get, update, delete, restore), `POST /:id/install`,
  `/:id/remove`, `/:id/rotate`, `/:id/scrap`, `GET /tyres/history`,
  `GET /tyres/vehicles/:vehicleId/positions`.
- Frontend: sidebar **Tyres → Tyre Master, Tyre History**; tyre detail page; a **Tyres** card with
  a wheel diagram on each vehicle page.

---

## Phase 9 — Fuel Tracking & Cost Calculation

**Status:** DONE (backend and frontend) — built to the client's actual site workflow; see
"As built" below

**Backend**
- `FuelTransaction`: `assetType`, `assetId`, `txnDate`, `quantity`, `pricePerLitre`,
  `amount`, `meterReading`, `siteId`, `notes`.
- **`amount = quantity × pricePerLitre`, computed server-side** — a client-supplied
  amount is ignored (§19).
- **Vehicle KM/Litre** from consecutive odometer readings (needs ≥ 2 entries).
- **Machinery cost per operating hour** = total fuel cost ÷ operating hours.
- Reject a meter reading below the last recorded one; quantity and price must be positive.

**Frontend**
- `FuelTransactionsPage` — list, filters (asset, date range, site), add/edit form with
  live amount calculation.
- Efficiency panel on the asset detail page: KM/L for vehicles, cost/hour for machinery.

**Exit criteria**
- [x] Amount is server-calculated; tampering with it client-side has no effect
- [x] KM/L appears for vehicles only, cost/hour for machinery only — never swapped
      (refinement: a Heavy Vehicle is hours-based, so it also gets cost/hour, never KM/L)
- [x] A backwards meter reading is rejected
- [x] A single fuel entry shows "not enough data" rather than a wrong KM/L

### As built

**The real workflow (client's request).** Fuel is not filled straight into each asset at a
pump. A carrier vehicle from a site goes to a fuel station, fuel is filled into cans, the
vehicle returns, and the site then fills its vehicles and machines from that stock:

```
Collect at pump (FC-…, in transit) → Receive at site (adds to site stock, records transit loss)
  → Issue to vehicle / machine (from site stock)  — or a direct pump fill
```

**Backend** — migrations `0041`–`0048` and `0052`
- `fuel_stations` — Admin-managed pump list (code `FST-…`, archive/restore).
- `fuel_collections` + `fuel_collection_containers` — a pump purchase (`FC-…`): site, carrier
  vehicle (must be at that site), station, fuel type (Diesel/Petrol — CNG can't be carried in
  cans), cans as "count × litres", rate per litre; litres and amount are server-calculated.
  Status `in_transit` → `received` or `cancelled`. Receiving records the litres that arrived
  (never more than collected); the shortfall is stored as transit loss (litres and ₹).
- `site_fuel_stocks` — on hand, average cost per litre and stock value per site + fuel type;
  `fuel_stock_ledger` — permanent movement record (`RECEIPT`, `ISSUE`, `ISSUE_REVERSAL`)
  with the balance after each movement. One function changes stock, under a row
  lock; stock can never go below zero; the average cost is recalculated only on receipt.
- `fuel_transactions` (fuel issues) gained `source`: `SITE_STOCK` (cost = litres × the site's
  average cost at that moment, saved on the entry) or `DIRECT_PUMP` (price typed, station
  optional, site stock untouched — e.g. CNG vehicles or the carrier filling its own tank).
  Existing entries were kept as direct pump fills. Meter-order rules and KM/L / cost-per-hour
  efficiency are unchanged and count both sources.
- Fuel stock checks were built and then **removed at the client's request** (migration `0052`
  drops `fuel_stock_adjustments` and the ledger's `ADJUSTMENT` type). Site stock changes only
  through receipts and issues.
- Deleting a site-stock issue (Admin, type DELETE) returns the fuel to stock at its original
  cost. A received collection can't be edited or cancelled.
- APIs: `/api/fuel-stations`, `/api/fuel-collections` (+ `/:id/receive`),
  `/api/site-fuel-stock` (+ `/ledger`), `/api/fuel-transactions` (+ `/efficiency/:assetType/:assetId`),
  `/api/fuel-reports/site-register`, `/asset-consumption`,
  `/collections`.
- Permissions: `FUEL_STATION` (Admin creates/edits), `FUEL_COLLECTION` (both roles create,
  edit, receive; cancel Admin-only), `FUEL_STOCK` (read, both);
  existing `FUEL` unchanged (delete Admin-only). Supervisors are limited to their own site.

**Frontend** — sidebar section **Fuel**
- **Fuel Stock** — stock by site (on hand, in transit, average cost, value) and a
  Movements tab.
- **Fuel Collections** — list, record/edit form with live litres and amount, detail page with
  **Receive fuel** (live transit-loss preview), Edit and Cancel.
- **Fuel Issues** — list with filters, **Issue fuel** form (from site stock with available
  litres and estimated cost, or direct at pump), edit, delete.
- **Fuel Reports** — site fuel register, fuel by asset, collections by station and carrier.
- **Fuel Stations** (Admin only).
- **Fuel** card on every vehicle and machine page (KM/L or cost per hour, totals, links).

**Verification** — on a disposable test organization, deleted afterwards: API 106/106 checks
(including stock never going negative under simultaneous issues, and stock always equal to
the sum of its ledger), browser 36/36 checks as Admin and Supervisor.

---

## Phase 10 — Compliance & Document Expiry

**Status:** DONE — backend and frontend verified live (see "As built" at the end of this
phase). Expiry tracking for the five document types was pulled forward earlier at the client's
request (addenda below); the phase itself finished on top of that work.

**Backend**
- `ComplianceDocument`: type, `assetType`+`assetId`, `documentNumber`, `issueDate`,
  `expiryDate`, `attachmentId`, computed status.
- **Expiry rules (§20):** expired → **Critical**. Insurance expiring within **15 days** →
  **Priority Alert**. Everything else → valid.
- `GET /api/compliance/alerts` returning both buckets, severity-ordered.
- Index `(tenant_id, expiry_date)`.

**Frontend**
- `ComplianceDocumentsPage` — list with severity badges, expiry filters, add/edit form.
- Compliance tab on the asset detail page.
- (File upload UI is stubbed here; real storage lands in Phase 14.)

**Exit criteria**
- [x] An expired document shows Critical
- [x] Insurance expiring in 14 days shows Priority Alert; in 16 days it does not
      (per the client's earlier request the 15-day window covers all five document types)
- [x] Alerts are severity-ordered and tenant-scoped (and site-scoped for supervisors)

**Addendum — expiry tracking for Road Tax, National Permit, Insurance, State Permit and PUC
(client's request, pulled forward)**

Built ahead of schedule, shaped differently from the section above in three ways the client
asked for explicitly:

- **Five document types, not a generic one.** `ComplianceDocument` (migration `0011`) has a
  fixed `docType` enum (`ROAD_TAX`/`NATIONAL_PERMIT`/`INSURANCE`/`STATE_PERMIT`/`PUC`), each
  shaped differently: Road Tax carries a `roadTaxType` (OTT/LTT/OTHER) and only tracks an
  expiry when OTHER (OTT/LTT are fixed-term, not expiry-tracked); National Permit is
  expiry-date-only; Insurance/State Permit/PUC carry a start date and an end date. One row per
  (tenant, assetType, assetId, docType) — saving again replaces it, the same upsert shape
  `AssetDocument` uses for file uploads (a deliberately separate concern from that feature —
  see `AssetDocument`'s own comment; that table was itself later consolidated from
  vehicle-only to generic, see the Phase 3 addendum above).
- **The 15-day rule applies to all five types, not Insurance alone.** `status` (`EXPIRED` /
  `EXPIRING_SOON` / `VALID`) is derived on the model, never stored, from
  `ComplianceDocument.EXPIRY_WARNING_DAYS = 15`.
- **Generic across asset types from day one**, reached through the same `assetType`+`assetId`
  pair `resolveAsset()` already established — `/api/compliance/:assetType/:assetId` rather than
  nested under `/vehicles` or `/machinery`, so the identical logic serves both without
  duplication.

`GET /api/compliance/alerts` (this section's own endpoint name, arrived at independently)
returns every expired/expiring-soon record tenant-wide, severity-ordered, resolved back to the
owning asset (`assetSurrogateId`, `assetLabel`) so an alert can link somewhere — this is the
"notification system" the client asked for: an in-app view, not email/push (nothing in the
request specified outbound delivery, and no such infrastructure exists in this app yet).
`ComplianceAlertsPage` is the tenant-wide list. There is no file attachment on a compliance
record — `attachmentId` above remains real Phase 14 work, same as this section always intended.

Verified live: 40/40 backend checks (all five doc types' validation shapes, upsert-replaces-not-
duplicates, cross-tenant 404s, unknown asset/doc type → 400, alerts severity ordering and
tenant scoping) + 22/22 browser checks (dropdown/date-range forms, badge text, the alerts page
linking back to the correct asset).

**Update — compliance fields moved onto the asset create/edit form (client's request)**

The first pass put a `ComplianceCard` on `VehicleDetailPage`/`MachineryDetailPage`, each field
saved individually via `PUT /api/compliance/:assetType/:assetId/:docType` (that endpoint still
exists and still works — see above — it is just no longer called from the UI). The client
explicitly rejected that shape: "do not create a separate Compliance section or box... include
the compliance fields within the existing asset creation forms." `ComplianceCard` was deleted
and replaced with `ComplianceFields`, rendered inline inside `VehicleFormPage`'s and
`MachineryFormPage`'s own `<form>` — the same visual pattern the Documents section already used
(a bordered sub-section within the same card, not a second card).

This meant compliance data had to become part of asset creation itself, which is not trivial:
`ComplianceDocument` rows are keyed by an asset's business `assetId` (e.g. `VEH-000001`), which
is only generated *inside* the transaction that creates the vehicle/machine row. The fix:
`complianceDocument.service.js#saveComplianceDocuments(..., transaction)` — a bundled-payload
save that `vehicle.service.js`/`machinery.service.js`'s own `createVehicle`/`createMachine` and
`updateVehicle`/`updateMachine` call *inside their own transaction*, right after the asset row
exists. A doc type the admin left blank is skipped entirely (no forced requirement, matching
the original design); an invalid one (e.g. an Insurance end date before its start date) rolls
back the whole create — the vehicle is never left half-created with broken compliance data.
Vehicle creation is `multipart/form-data` (RC/PUC files), so the bundled compliance object
travels JSON-stringified in a plain field and is parsed back out server-side; Machinery
creation is plain JSON, so no such encoding is needed. Editing pre-populates the fields from
whatever was already saved (`GET /api/compliance/:assetType/:assetId`, mapped by
`complianceSlotsToFormValue`); leaving a previously-entered field alone on a later edit leaves
that record untouched, and clearing it in the form does not delete the saved record (no delete
story was asked for).

Verified live: 17/17 backend checks (bundled save atomic with create, no-compliance-data create
still succeeds, invalid compliance data rolls back the entire vehicle create, edit adds/updates
without disturbing untouched doc types, machinery uses the identical path) + 25/25 browser
checks (every compliance field genuinely inside the same `<form>` as the rest of the asset's
fields — asserted by counting `<form>` elements on the page — pre-population on edit, and the
detail pages confirmed to no longer render a separate Compliance box).

**Update — Compliance Alerts reverted, deferred back to this phase (client's request)**

The tenant-wide alerts view built above — `GET /api/compliance/alerts`,
`getComplianceAlerts()`, the `alerts` controller action and route, `ComplianceApi.alerts()`,
`ComplianceAlertsPage`, and the sidebar's "Compliance → Alerts" entry — was removed. The client
wants this rebuilt properly as part of this phase itself rather than kept as an early,
narrower version now. **Nothing else from the addenda above was touched**: the five compliance
doc types, their per-type validation shapes, the 15-day-window status computation on
`ComplianceDocument` itself (`status`/`daysRemaining`, still returned in every compliance
response), the inline `ComplianceFields` on both asset forms, `saveComplianceDocuments`'s
atomic-with-create/edit behaviour, and the standalone `GET`/`PUT /api/compliance/:assetType/:assetId[/:docType]`
endpoints all remain exactly as built and verified above — only the aggregated,
tenant-wide alerts *view* is gone. `config/compliance.js` on the frontend also dropped
`DOC_TYPES`/`DOC_TYPE_LABELS`, which had no remaining caller once the alerts page (their last
consumer) was deleted; `ROAD_TAX_TYPE_OPTIONS` and `complianceSlotsToFormValue`, which the
surviving form fields actually use, were untouched.

Verified live: 6/6 backend checks (`/compliance/alerts` → 404; bundled compliance save on
create, the standalone list/save endpoints, and document upload all still work exactly as
before) + 7/7 browser checks (sidebar no longer shows a Compliance section, `/compliance-alerts`
falls through to Not Found, the Vehicle/Machinery forms still render both the Compliance fields
and the Documents section unchanged).

**Update — Add Vehicle / Add Machinery form layout widened and reorganized (client's request,
UI-only)**

Purely a CSS/layout pass on `VehicleFormPage`/`MachineryFormPage` and the two shared field
components they render (`ComplianceFields`, `AssetDocumentFields`) — no backend, database, API,
validation, or business-logic file was touched, and no field was added, removed, renamed, or
reordered between sections. Changes:

- Form container widened from `max-w-2xl` (672px) to `max-w-4xl` (896px) on both pages, so the
  two-column field grid has room to breathe instead of cramming two `Field`s into a narrow card.
- Added a `Vehicle Details`/`Machine Details` `<h2>` above the base fields grid, matching the
  existing `Compliance`/`Documents` section headings already in the form, so the form now reads
  as three clearly labelled sections instead of an unlabelled block followed by two labelled ones.
- Base fields grid gap widened (`gap-x-4` → `gap-x-6`) to match the new width.
- `ComplianceFields`'s subtitle — "Optional — fill in what you have now; anything left blank can
  be added later by editing." — removed entirely, per the client's explicit instruction. The
  `Compliance` heading and every field beneath it are untouched; compliance remains inline inside
  the same `<form>`/card as the rest of the asset fields — **no separate Compliance section or
  box was introduced**, consistent with the constraint re-confirmed in this same request.
  Each compliance `Row`'s internal grid gap was also widened (`gap-3` → `gap-x-6 gap-y-4`) for
  visual parity with the base fields grid.
- `AssetDocumentFields`'s `Documents` heading margin adjusted (`mb-1` → `mb-3`) for spacing
  parity with the other two section headings, now that the Compliance subtitle (which set that
  precedent) is gone.

Verified live: 16/16 browser checks across three viewports (390×844 mobile, 820×1180 tablet,
1440×900 desktop) for both Add Vehicle and Add Machinery — no horizontal overflow at any
breakpoint, the removed subtitle text confirmed absent, the new section headings present, still
exactly one `<form>` and one Card container per page (proving no separate Compliance box was
introduced), and the desktop form container measured at 896px (up from the old 672px). Screenshots
at all three breakpoints were reviewed visually and confirm a clean, professional, single-column
stack on mobile and an organized two-column layout on desktop/tablet.

**Update — `name` and `registrationNumber` added to Machinery; `serialNumber` relabelled
"Chassis Number" (client's request, Machinery only)**

Migration `0014-add-machinery-name-and-registration.js` adds two nullable columns to
`machinery`: `name` (VARCHAR 150, "Machinery Name" in the UI) and `registration_number`
(VARCHAR 32). Both are optional — confirmed with the client rather than assumed, since not
every machine is registered or given a name — and `registration_number` carries **no**
uniqueness constraint, unlike `vehicles.registration_number`, which is required and unique per
tenant. `serial_number` itself is untouched; only its UI label changed from "Serial Number" to
"Chassis Number" — the client was explicit this was a label change, not a rename, so the
column, the model field, and `form.serialNumber`/`update('serialNumber')` in the form all keep
their original name.

Backend: `Machinery.init` gains `name`/`registrationNumber`, both returned from
`toPublicJSON`; `machinery.service.js#readMachineryInput` validates both with `optionalText`
(matching `modelNumber`'s treatment, not `registrationNumber`'s required+unique treatment on
the vehicle side); `listMachinery`'s search now also matches `name` and `registrationNumber`
alongside the existing `assetId`/`modelNumber`/`serialNumber`; both new fields were added to
`SORTABLE_FIELDS`.

Frontend, Machinery only — `VehicleFormPage`/`vehicle.service.js` were not touched:
- `MachineryFormPage`: two new fields ("Machinery name", "Registration number") added at the
  top of the Machine Details grid, ahead of Type — mirroring where Vehicle's own Registration
  Number sits on its form. The existing field's `<Field>` label changed from "Serial number" to
  "Chassis number"; its `value`/`onChange` still read/write `form.serialNumber`.
- `MachineryDetailPage`: added `Detail` entries for "Machinery name" and "Registration number";
  "Serial number" relabelled "Chassis number" (same `machine.serialNumber` value).
- `MachineryListPage`: added sortable "Name" and "Registration" columns; "Serial number" column
  relabelled "Chassis number"; the search placeholder now mentions all four searchable fields.
- `AllAssetsPage` (combined Vehicle+Machinery view): for a machinery row only, the combined
  "Reg. / Serial no." column (relabelled "Reg. / Chassis no.") now prefers the new
  `registrationNumber` and falls back to `serialNumber` when blank. The Vehicle branch of that
  same column is untouched.

Verified live: 26/26 browser checks — the new fields and renamed label appear on Add Machinery;
a created machine's values round-trip through the detail page and the list page (including
list search by the new name field); the edit form pre-fills a saved Machinery Name and a save
updates it; a second machine created with both new fields left blank still saves successfully
(confirming they are genuinely optional); and the Vehicle create form was re-checked afterward
to confirm none of the new Machinery-only fields or the pre-existing "Chassis number"/
"Registration number" fields there were disturbed.

### As built

Built on top of the addenda above. Their shape is unchanged: five fixed document types, one
record per asset and type, entered inline on the asset forms, with no separate Compliance box on
the asset pages.

**Deviations from the field list at the top of this phase, each deliberate:**
- **The 15-day Priority Alert covers all five types, not Insurance alone**, as the client asked
  in the first addendum. The exit criterion (Insurance at 14 days alerts, at 16 it does not)
  still holds.
- **`issueDate` is the existing `startDate`.** Road Tax and National Permit carry no start date.
- **No `attachmentId`.** File storage stays Phase 14 work. RC/PUC/Permit/Insurance files are
  already uploaded through `AssetDocument`, which is a separate feature.
- **"Compliance tab on the asset detail page" is a `Compliance` button** in the Vehicle and
  Machinery detail-page headers. It opens the Compliance page filtered to that asset. The client
  had rejected a Compliance card on those pages, so none was added.
- **Editing stays on the asset form.** "Update" on the Compliance page opens the asset's edit
  form scrolled to its Compliance section (`/vehicles/:id/edit#compliance`). There is no second
  compliance form.

**Backend** — migration `0064-compliance-document-number` (reversible; adds nullable
`document_number` VARCHAR(64)). The `(tenant_id, expiry_date)` index already existed from `0011`.
- `ComplianceDocument` gains `documentNumber` and a derived `severity`: `CRITICAL` when
  `EXPIRED`, `PRIORITY` when `EXPIRING_SOON`, otherwise null. Both are returned in every
  compliance response. Days remaining now treat the stored date as a local calendar date. Before,
  it was parsed as UTC midnight, which is a day off on servers west of UTC. This also makes it
  match the SQL filters exactly.
- Document numbers are optional on all five types (max 64 characters, trimmed). They are saved by
  the bundled asset create/edit and by the standalone `PUT`. A number entered without its dates
  is rejected with the type's normal date error.

```
GET    /api/compliance            list: expiry (ATTENTION | EXPIRED | EXPIRING_SOON | VALID |
                                  NO_EXPIRY), docType, assetType, assetId, siteId (admin),
                                  search (asset ID, registration, RCPL, machine name, number),
                                  sort expiryDate | docType | assetId | updatedAt, page/limit;
                                  `summary` counts each bucket in the same scope
GET    /api/compliance/alerts     every Critical + Priority Alert document, severity-ordered
                                  (expired first, most overdue first), with { critical, priority }
DELETE /api/compliance/:id        admin only, { confirmation: "DELETE" }
```

- Lists and alerts join each document to its vehicle or machine. Documents of archived assets are
  left out. Supervisors only see their own site's assets, and a `siteId` they send is ignored.
  Each row carries `assetLabel` (registration, or RCPL · name), `assetRecordId` (for links) and
  `siteId`.
- Sorting by expiry date is severity order: every expired date comes before today and every
  soon-expiring date. Documents with no expiry date (Road Tax OTT/LTT) always sort last.
- **Delete** is a hard delete, because a compliance record has no history of its own. It writes a
  `DELETED` audit row holding the full record first, the same pattern tyre fitments use. The
  document type can then be entered again from the asset form. Bad filter values return 400. A
  non-numeric or other-tenant id returns 404. A supervisor gets 403.

**Frontend** — sidebar **Compliance → Compliance Documents** (`/compliance`):
- Four summary tiles (Critical, Priority alert, Valid, No expiry date). Clicking one filters the
  list.
- Filters: expiry (default **Needs attention**), document type, asset type, site (admin only),
  search. Supports `?assetType=&assetId=` and `?expiry=` deep links.
- Table columns: asset link, document, number, start, expiry, days remaining ("Expired 3 days
  ago", "Expires today", "14 days left"), status badge, site, Update link, and Delete (admin
  only, DELETE-word modal).
- `ComplianceFields` gains a number field in each row and the `#compliance` anchor.
  `config/compliance.js` gains the document-type labels and status/badge metadata the page uses.

**Verified live** on a fresh database built from the repo's migrations (`0001`–`0064`, plus
`0064` down/up), never the dev `vmms` database. Throwaway scripts lived in the scratchpad and
were deleted afterwards, along with the database:
- **66/66 API checks**:
  - The boundaries: Insurance at 14 days is Priority; a permit at 15 days is Priority (the
    window includes day 15); 16 days is Valid with no alert; today is Priority with 0 days left;
    expired 3 days is Critical; Road Tax OTT has no status.
  - Alerts list every Critical before any Priority, most overdue first, with correct summary
    counts. A 16-day document and an archived asset's expired insurance are left out.
  - Tenant B sees only its own documents. Supervisor alerts and lists are limited to their site,
    including when they pass another `siteId`.
  - Each expiry bucket, document type, asset type, admin site filter, the four search fields, the
    asset deep link, pagination, and sorting by type and by expiry in both directions. Bad
    filters return 400; no token returns 401.
  - Document numbers on bundled create, vehicle edit, and supervisor `PUT` (trimmed). A
    65-character number and a number without dates are rejected.
  - Delete: supervisor 403, wrong word 400, non-numeric and cross-tenant id 404, admin 200, the
    `DELETED` audit snapshot checked in the database, a repeat delete 404, and the type entered
    again afterwards.
- **32/33 browser checks** (headless Chrome via Playwright, run from the scratchpad):
  - Admin: the sidebar entry, tile counts and tile filtering, the default Needs-attention view
    in severity order, filters and search, and Update opening the edit form scrolled to
    Compliance with the number pre-filled. Saving the edit showed the new number on the list.
  - The detail-page Compliance button gives the per-asset view. The DELETE-word delete works.
    Add Machinery shows the number fields and still has one `<form>`. No horizontal overflow at
    390px.
  - Supervisor: no Site filter or Delete controls, own-site rows only, and a raw DELETE returns
    403.
  - The one failure was Chrome's automatic `/favicon.ico` request returning 404. The app has no
    favicon, which predates this phase. No API call failed.
- `npm run build` clean.

**Update — Compliance Documents frontend removed, backend kept (client's request)**

The client approved the functionality but asked for the Compliance Documents UI to be removed
while keeping the backend. Removed:
- `pages/compliance/ComplianceDocumentsPage.jsx`, its `/compliance` route, and the sidebar
  **Compliance** section.
- The **Compliance** button on the Vehicle and Machinery detail pages.
- `complianceApi.listAll` / `alerts` / `remove`.
- The page-only config in `config/compliance.js` (document-type labels, status/badge metadata,
  days-remaining text).
- The `#compliance` scroll anchor in `ComplianceFields`.

Kept unchanged:
- Every backend piece: migration `0064`, the model, `GET /api/compliance`,
  `GET /api/compliance/alerts`, `DELETE /api/compliance/:id`, the per-asset `GET`/`PUT`, and all
  validation and scoping.
- The inline compliance fields on the asset forms, including the document-number inputs. Those
  belong to the asset create/edit forms, and they round-trip saved numbers. Without them, an
  edit would send no number and clear one saved earlier.

`/compliance` now falls through to Not Found. `npm run build` is clean. All five compliance
endpoints were exercised again on a throwaway database, with the expected 200/400/401/404
responses.

**Update — Compliance Documents frontend restored (client's request)**

After testing the backend on its own in Postman, the client asked for the frontend back. It was
restored exactly as described in "As built" above, with no backend change:
- `ComplianceDocumentsPage` and its `/compliance` route.
- The sidebar **Compliance → Compliance Documents** entry.
- The **Compliance** button on the Vehicle and Machinery detail pages.
- `complianceApi.listAll` / `alerts` / `remove`.
- The page's config in `config/compliance.js`.
- The `#compliance` anchor in `ComplianceFields`.

Verified live on a throwaway database, migrations `0001`–`0065`, deleted afterwards: 20/20
browser checks as Admin and Supervisor. These covered tile counts and filtering, the
severity-ordered default view, filters and search, Update → edit form at Compliance → save, the
detail-page button, DELETE-word delete, the Add Machinery form unchanged, no overflow at 390px,
supervisor scoping with no Delete controls, and no failed API calls. `npm run build` clean.

**Update — Delete removed from the Compliance Documents page (client's request)**

The page no longer has a Delete action for anyone. Its confirm dialog and
`complianceApi.remove` are gone too, so the actions column holds only **Update**.

The client then asked for delete to go from the backend as well. `DELETE /api/compliance/:id`,
the controller's `remove` and `deleteComplianceDocument` were removed, so a compliance record
can no longer be deleted. It can only be updated from the asset form or through
`PUT /api/compliance/:assetType/:assetId/:docType`.

Verified live on a throwaway database, deleted afterwards: 7/7 checks. `DELETE` now returns 404
and the record remains. The list, alerts, per-asset `GET`, `PUT` and the bundled save on asset
create still work.

**Dev database note:** `0064` has not been run on the dev `vmms` database. Run
`npm run migrate` in `server/` before restarting the API. Until then, any compliance query fails
on the missing `document_number` column.

---

## Phase 11 — Dashboard

**Status:** NOT STARTED

**Backend**
- `GET /api/dashboard` — every aggregate's WHERE clause starts with `tenant_id = ?` (§22).
- KPIs: total vehicles, total machinery, vehicles service-due, machinery service-due,
  compliance expired, compliance expiring ≤15 days, active breakdowns, monthly fuel cost.
- Alerts, severity-ordered: compliance expired (Critical) → insurance ≤15 days
  (Priority) → service-due → ongoing breakdowns with elapsed downtime.
  A `GET /api/compliance/alerts` was built once already as an early version of this compliance
  bucket (Phase 10's addenda), then deliberately reverted at the client's request so the real
  version could be built properly as part of Phase 10/11 instead — `ComplianceDocument.status`/
  `daysRemaining` (per-record, 15-day-window) are still there to query against, but there is no
  existing alerts endpoint to call into; this phase builds that aggregate itself.
- **Role shaping:** admins additionally get cost analytics; supervisors get the
  operational summary (§22).

**Frontend**
- The real dashboard: KPI cards, alert list, quick links.
- Cost widgets wrapped in `ProtectedElement roles={['admin']}`.

**Exit criteria**
- [ ] Every KPI matches a hand-checked query against the seed data
- [ ] A second tenant's data never appears in any figure
- [ ] Supervisors see the summary; the cost analytics block is absent for them
- [ ] Alerts are correctly ordered by severity

---

## Phase 12 — Reports Hub (view + print)

**Status:** NOT STARTED

**Backend**
- `GET /api/reports/:type` — both roles. Types: asset, maintenance, fuel, tyre,
  compliance, breakdown, site, cost. Each with search, filter, sort, pagination,
  all tenant-scoped (§23).
  The `compliance` report type now has a real table to read from
  (`compliance_documents`, Phase 10's addendum) and a real `sites` table for the `site`
  report type (Phase 5's addendum) — both pulled forward ahead of this phase.

**Frontend**
- `ReportsHubPage` listing all report types.
- A shared report viewer: filter bar, results table, pagination.
- **Print** action for both roles, using a **print stylesheet** that strips sidebar,
  header, and all interactive controls, and prints organization name, report title,
  applied filters, and generation timestamp (§23).

**Exit criteria**
- [ ] All 8 report types return correct, tenant-scoped data
- [ ] Print preview shows a clean document — no nav, no buttons, no sidebar
- [ ] The printed header carries org name, title, filters, and timestamp
- [ ] Supervisors can view and print every report

---

## Phase 13 — Report Export (admin-only)

**Status:** NOT STARTED

**Backend**
- `GET /api/reports/:type/export?format=excel|pdf` behind **`protectAdminRoute`**,
  plus a `hasPermission(role,'REPORTS','EXPORT')` re-check (§23).
- Excel via `exceljs`; PDF via `pdfkit`. Same filters as the view endpoint.

**Frontend**
- Export buttons rendered only via `ProtectedElement roles={['admin']}`.

**Exit criteria**
- [ ] Admin downloads a correct Excel and PDF for each report type
- [ ] The Export control is absent for supervisors
- [ ] A raw export request as a supervisor returns **403**
- [ ] Exported rows contain the caller's tenant data only

---

## Phase 14 — Attachments & Audit History Views

**Status:** NOT STARTED

**Backend**
- `Attachment` model (tenant-scoped metadata + storage path), local-disk driver with an
  S3-compatible driver behind the same interface, selected by `STORAGE_DRIVER` (§28).
  `AssetDocument`/`storage.service.js` (pulled forward, see Phase 3's addendum) already cover
  this shape for RC/PUC/National Permit/Insurance specifically, generic across vehicles and
  machinery via `assetType`+`assetId` — a generalised `Attachment` here should build on that
  same driver and key rather than introducing a second one.
- Upload/download/delete endpoints; MIME + size validation; tenant-scoped path layout so
  one tenant can never read another's file.
- `GET /api/audit` — filter by entity type, entity id, user, date. Both roles view.

**Frontend**
- Real file upload on compliance documents (and anywhere else attachments apply) — note
  compliance documents are date-only by design (Phase 10's addendum); if this phase adds a
  file to a compliance record, that is new scope, not a gap being filled.
- `AuditHistoryPage` and a per-record history drawer showing who/what/when + before/after.

**Exit criteria**
- [ ] Uploading, viewing, and deleting an attachment works on compliance documents
- [ ] A file belonging to another tenant is not reachable by guessing its URL
- [ ] Audit history renders before/after diffs for create, update, delete, and role changes

---

## Phase 15 — Excel Migration Tooling

**Status:** NOT STARTED

**Backend**
- A CLI importer that normalises the supplied workbook into the relational schema.
- Every row stamped with the correct `tenant_id`; inserts respect FK order
  (tenants → users/assets → dependent records) (§28).
- Dry-run mode, a validation report, and per-row error output. Idempotent re-runs.
- **Never reproduces the spreadsheet's structure** — it maps into the real schema.

**Exit criteria**
- [ ] A dry run reports what would be imported and every validation failure
- [ ] A real run imports cleanly into one target tenant
- [ ] Re-running does not duplicate rows
- [ ] Migration guide documented

---

## Phase 16 — Hardening, Security Review, Deployment & Docs

**Status:** NOT STARTED

**Hardening**
- Rate limiting on the auth routes; input sanitisation; security headers (helmet).
- Index and performance review against §24's index list; `EXPLAIN` the dashboard and report
  aggregates and fix anything doing a full scan.
- Confirm no stack trace, driver message, token or password hash can reach a client.

**Security review — a manual sweep across every module (§31 Phase 13)**
Walk each module in turn against the running API and record the result:
cross-tenant read → 404; supervisor delete → 403; role escalation blocked; report export
admin-only; and `tenantId` never honoured from the body, query string or URL params.
This is the sweep that replaces the automated suite the spec asked for, so it is done
deliberately and written down, module by module.

Plus the account-structure rules, re-checked once the whole system exists: one admin and one
supervisor per organization still enforced by constraint; no account reachable from a second
organization; email still globally unique; and a suspended organization locking out both of
its accounts on the next request.

**Deployment**
- Production build for the client; production start path for the API.
- Documented environment variables for a production host; migrations run as a deploy step.
- A health endpoint suitable for a load balancer; graceful shutdown on SIGTERM.
- Verify the whole §32 workflow end to end against a production-mode build, signup through
  export.

**Docs**
- README (setup, run, build, deploy), API reference, architecture notes, migration guide,
  and a decisions log recording the Sequelize choice, the column-naming choice from
  Phase 0.5, the no-test-suite decision, and every other resolved ambiguity.

**Exit criteria**
- [ ] The security sweep passes for every module, with results recorded
- [ ] The full §32 workflow works end to end against a production build
- [ ] No critical console errors; no broken routes; no layout overflow; responsive
- [ ] The app runs from a clean checkout following only the README
- [ ] Documentation complete

---

## Phase 17 — Inventory & Stock Management

**Status:** DONE (backend and frontend)

Not part of the spec's original phase list — added at the client's request as a complete
module, independent of Phases 6–8 and 11–16. Specified in `VMMS_Master_Specification (1).md`
§37. Built on the same tenant, site and role rules as every other phase.

**Goal:** record what parts and consumables are bought, where they are kept, what is issued
to each vehicle or machine, what moves between sites and what a physical count corrects —
with correct cost at every step.

**Backend** — migrations `0020`–`0040` and `0049`–`0051`
- **Item catalog** (Admin creates/edits, both roles read; archive/restore): item categories,
  units of measure, items (with optional minimum / reorder / maximum levels), suppliers
  (phone and email validated), storage locations (each belongs to one site).
- **Purchase → Receive** (`PO-…`): a purchase is a draft with no stock effect until
  received. Lines carry quantity, unit price (as on the bill, before tax), tax %, and a
  server-calculated purchase price (line total incl. tax). Receiving posts the stock at the
  **unit price including tax**; a received purchase can't be received again or edited.
- **Stock ledger**: `inventory_transactions` (every movement) and `stock_balances` (quantity
  per site + item + storage location). One function changes stock, under a row lock; stock
  can never go below zero.
- **Batch costing (oldest first)**: `stock_batches` keeps each receipt as a batch with its
  own price and remaining quantity; `stock_batch_movements` records which batches each
  movement used. Issues, transfers and stock checks consume the oldest batch first, so every
  cost is the price actually paid. Reversals return units to the exact batches they left.
  Existing stock at the time this was introduced became one "Opening stock" batch per row.
- **Asset Issue & Reversal** (`ISS-…`, `REV-…`): stock issued to a vehicle or machine at its
  site, with the asset's meter reading (KM or Hours); a line can't be reversed for more than
  is outstanding.
- **Stock Adjustment** (`ADJ-…`): counted vs. system quantity; only the difference is posted.
  Missing units come out of the oldest batch; extra units are valued at the latest purchase
  price. Only items with stock at the site can be adjusted.
- **Stock Transfer** (`TRF-…`) — **Admin only**: dispatch moves nothing; receive moves both
  sides together, at the same batch prices and dates, or fails and moves nothing.
- **Site-based item filtering**: Asset Issue, Stock Transfer and Stock Adjustment only offer
  items in stock at the selected site (also enforced server-side). Purchase offers all items.
- APIs: `/api/item-categories`, `/api/units-of-measure`, `/api/items`, `/api/suppliers`,
  `/api/storage-locations`, `/api/purchases` (+ `/:id/receive`), `/api/stock/balances`,
  `/api/stock/transactions`, `/api/asset-issues`, `/api/issue-reversals`,
  `/api/stock-adjustments`, `/api/stock-transfers` (+ `/:id/receive`).

**Role permissions** (`config/permissions.js`, server and client)

| Resource | Create | Read | Update | Receive / Reverse |
|---|:---:|:---:|:---:|:---:|
| Item catalog (categories, units, items, suppliers, storage locations) | Admin only | Both | Admin only | — |
| Purchase | Both | Both | Both | Both (Receive) |
| Stock (balances & history) | — | Both (read-only) | — | — |
| Asset Issue | Both | Both | — | Both (Reverse) |
| Stock Adjustment | Both | Both | — | — |
| **Stock Transfer** | **Admin only** | **Admin only** | — | **Admin only** |

A Supervisor only ever sees and records data for their own site.

**Frontend** — sidebar section **Inventory**
- **Item Catalog** — tabs for Items, Categories, Units of Measure, Suppliers, Storage Locations.
- **Stock Movements** — purchases, issues, transfers (Admin only) and adjustments in one feed,
  newest first, with forms and detail pages for each.
- **Stock** — **Stock Balances** (Item, Available, Site, Storage location, Status, Latest
  price, Bought at, Stock value, Last movement; batch details popup) and **Transaction
  History** (with Date as the last column). Site, item, storage location and type filters,
  newest first. All prices, costs and values include tax.
- Purchase screens show unit price incl. tax and **Purchase price (incl. tax)**; the form
  shows both live as the user types.

**Verification** — on disposable test organizations, deleted afterwards: batch costing and tax
62/62 checks, full regression 179 checks (2 failures are unrelated, pre-existing: sign-up
with a Supervisor row, and a test-script quirk), browser 17/17 checks.

**Known open items (not yet fixed)**
- An empty "Counted quantity" on a stock adjustment line is saved as 0.
- An empty purchase "Unit price" is saved as ₹0.
- Adjustment rows in Transaction History don't show whether stock went up or down.
- Lists and dropdowns load at most 100 records.
- Several asset issues saved at the same instant can collide on the issue number.

**Data note:** all Inventory records were cleared from the database at the client's request
after testing; the module starts empty and the catalog must be set up first.
