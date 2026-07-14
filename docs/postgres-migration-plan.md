# KRISHOE Postgres Migration Plan

This plan moves the app from local JSON files to Postgres without losing
factory, shop, customer, ledger, or audit data.

## Current State

- Runtime persistence is still local JSON in `data/*.json`.
- Backend selector scaffold is present in `lib/data-backend.ts`.
- Postgres repositories are implemented for all current persistence stores: products, orders, contact messages, users, password reset tokens, operations, POS invoices, purchasing, costing settings, HR, audit, notifications, and rate-limit attempts.
- Pending repositories: none.
- Orders now include payment status, provider, references, transaction IDs,
  callback IDs, and verified timestamps for the upcoming eSewa/Khalti phase.
- Protected admin backup is available at `/api/admin/backup`.
- Backup schema version is `13`.
- Backup includes sensitive data: users, password hashes, hashed password reset tokens,
  products, orders, messages, operations, audit events, and notification events.
  Payment transaction history is included for order payment audit and ledger
  linkage.
- POS invoice history is included with item lines, stock movement IDs, ledger
  transaction IDs, barcode values, and QR payloads.
- Supplier ledger, raw material purchase invoices, supplier transactions, and
  purchase-basis profit reporting data are included.
- Factory costing settings for labor rates and overhead allocation are included.
- HR employees, attendance, payroll records, and worker-performance reporting data are included.
- Backup export and Postgres import hash legacy plaintext reset tokens before
  writing them into migration artifacts or the target database.
- Notification delivery status, attempts, delivered time, channel, and last
  delivery error are included in backups.
- Rate-limit attempts are intentionally not included in backup because they are
  short-lived abuse-protection records.

## Migration Order

1. Export a fresh backup from `/api/admin/backup`.
   - Local helper: `npm run backup:export -- --url=http://localhost:3002`
2. Store the backup safely outside the deployed app.
3. Create a clean Postgres database.
4. Apply the schema using the app-owned script.
   - Example: `DATABASE_URL="postgres://..." npm run db:schema`
5. Import master data first:
   - products
   - users
   - raw materials
   - production batches
   - finished stock
   - customer ledgers
   - supplier ledgers
6. Import activity data second:
   - orders
   - contact messages
   - worker tasks
   - vehicle dispatches
   - vehicle dispatch items
   - stock movements
   - ledger transactions
   - payment transactions
   - POS invoices
   - supplier transactions
   - purchase invoices
   - hashed password reset tokens, if still needed
   - audit and notification events
7. Compare row counts with `backup.counts`.
8. Check `backup.integrity` before and after import.
9. Run app smoke tests using Postgres in preview.
10. Run read/write smoke tests for catalog, checkout, account, operations, backup, audit, notifications, and rate limiting.
11. Switch production env only after preview passes:
    - `DATA_BACKEND=postgres`
    - `DATABASE_URL=<postgres connection string>`

## Import Command

After exporting a fresh backup from `/api/admin/backup`, apply schema and
import it into a preview Postgres database:

```bash
npm run backup:export -- --url=http://localhost:3002
```

```bash
DATABASE_URL="postgres://..." npm run db:schema
```

```bash
DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v13.json
```

For a clean preview database where replacing all app rows is intended:

```bash
DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v13.json --replace --confirm-replace
```

The default import mode is idempotent upsert. The `--replace` flag truncates
the app tables first, so use it only against a preview database or a confirmed
restore target.

## Smoke Check Command

After schema setup and import, compare preview Postgres row counts with the
backup and run integrity checks:

```bash
DATABASE_URL="postgres://..." npm run db:smoke -- ./krishoe-backup-v13.json
```

Without a backup file, the command still checks table availability, relation
integrity, negative numeric values, and operations totals:

```bash
DATABASE_URL="postgres://..." npm run db:smoke
```

The command exits non-zero if counts or integrity checks fail.

## Integrity Checks

Before switching traffic, confirm:

- No duplicate IDs in backup or imported tables.
- No `ledger_transactions.ledger_id` without a matching customer ledger.
- No negative stock, sold, return, cash, cheque, credit, or balance values.
- No duplicate non-empty `orders.payment_callback_id` values.
- No duplicate non-empty `payment_transactions.payment_callback_id` values.
- No payment transaction points to a missing order or missing linked ledger.
- No POS invoice points to a missing ledger, ledger transaction, or stock movement.
- No purchase invoice points to a missing supplier, raw material, or supplier transaction.
- Operations dashboard totals match the JSON backup totals.
- Customer ledger detail pages show the same balance due as the backup.
- Admin backup still exports successfully after the switch.

## Rollback

Keep local JSON files and the exported backup until Postgres has been stable for
at least one full business cycle.

If Postgres write tests fail:

1. Set `DATA_BACKEND=local-json`.
2. Redeploy with the previous environment.
3. Restore `data/*.json` from the protected backup if needed.
4. Do not delete the failed Postgres database; keep it for comparison.

## Notes For Payment Phase

Payment routes should wait until Postgres is stable. Payment callbacks need
idempotency, immutable ledger transactions, and strict order/payment status
constraints. Those are easier and safer after the app writes to Postgres.
