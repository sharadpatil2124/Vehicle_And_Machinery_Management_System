# Vehicle & Machinery Management System (VMMS)

A multi-tenant web application for managing fleets of vehicles and machinery.
Each organization manages its own assets in complete data isolation.

---

## Recent Changes

### New modules
- **Maintenance** – preventive service schedule (overdue / due soon, by km or hours), breakdown tracking (reported → in progress → resolved) and maintenance history per asset.
- **Compliance** – tenant-wide Compliance Documents page with expiry alerts (Critical = expired, Priority Alert = expiring within 15 days).
- **Tyres (redesigned)** – tyre types, tyre purchases, per-site tyre stock, fitting/removal on vehicles and machinery, asset and cost reports.

### Updates
- **Dashboard** – monthly running cost can be filtered by site; supervisors now see cost for their own site.
- **Fuel** – transaction time, typed station name for direct-at-pump fills, asset km/hours updated from fuel entries, collection reports by station and by carrier.
- **Inventory** – purchase reports by supplier and by item; unused fields removed (batch number, expiry date, batch tracking, hazardous flag, storage capacity/type, issue remarks).
- **Machinery** – registration number replaced by **RCPL** (required, uppercase, unique per organization) with a live availability check on the form.
- **Compliance documents** – document number added; **PUC replaced by Fitness**.
- **Reports** – one shared searchable, sortable, paged report table used across Fuel, Inventory and Tyre reports.
- **Code cleanup** – source code comments removed.

### Earlier updates
- Inventory module: items, storage locations, purchases, stock, transfers, adjustments and asset issues.
- Site management, Fuel module and Dashboard improvements.


## Stack

| Layer | Technology |
|-------|-----------|
| Database | MySQL 8+ |
| ORM | Sequelize 6 |
| Migrations | umzug |
| API | Node.js 20+, Express 5 |
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Auth | JWT access tokens, bcrypt password hashing |

