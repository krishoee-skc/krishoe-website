# Postgres Adapter Scaffold

The app now has a backend selector and the first Postgres repositories.

## Current Behavior

- Default backend: `DATA_BACKEND=local-json`
- Safe selector: `lib/data-backend.ts`
- Postgres query boundary: `lib/postgres/client.ts`
- Main JSON stores now pass through the backend selector:
  - products
  - orders and contact messages
  - customer users
  - password reset tokens
  - operations
  - POS invoices
  - purchasing
  - costing settings
  - HR
  - admin audit events
  - notification events
  - rate limit attempts

Implemented Postgres stores:

- products
- orders
- contact messages
- users
- password reset tokens
- operations
- POS invoices
- purchasing
- costing settings
- HR
- admin audit events
- notification events
- rate limit attempts

Pending Postgres stores:

- none

If `DATA_BACKEND=postgres` is selected with a valid `DATABASE_URL`, all current
persistence stores use Postgres instead of local JSON. Rate-limit attempts are
ephemeral and are not exported in admin backups.

## Next Implementation Steps

1. Import a fresh `/api/admin/backup` into a preview Postgres database.
2. Run read/write smoke tests in preview with `DATA_BACKEND=postgres`.
3. Only then switch production.

## Important

The schema and adapters now cover all current persistence stores. Keep
production on local JSON until a preview Postgres import and read/write smoke
test passes.
