# Vehicle & Machinery Management System (VMMS)

A multi-tenant web application for managing fleets of vehicles and machinery.
Each organization manages its own assets in complete data isolation.

---

## Recent Changes

### Latest update

Account management: admins can edit their own profile, change their own password, and set a password for a supervisor.

Session revocation: a password change signs the user out on all devices. This needs migration 0067 to be run.

Asset cost summary: a cost card on the vehicle and machinery detail pages, with new /costs endpoints.

Printable reports: Maintenance History can now be printed.

## Stack

| Layer | Technology |
|-------|-----------|
| Database | MySQL 8+ |
| ORM | Sequelize 6 |
| Migrations | umzug |
| API | Node.js 20+, Express 5 |
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Auth | JWT access tokens, bcrypt password hashing |

