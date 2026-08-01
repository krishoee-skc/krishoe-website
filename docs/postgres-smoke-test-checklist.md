# Postgres Preview Smoke Test Checklist

Use this checklist only against a preview database first.

## Database Checks

1. Briefly pause order, purchase, HR, stock, Factory, and Production writes,
   then export and validate a fresh backup. The extension tables share one
   repeatable-read snapshot; the short write pause also keeps their referenced
   catalog/HR/stock master rows in the same business moment:

   ```bash
   npm run backup:export -- --url=http://localhost:3002
   ```

   Store the generated `backups/krishoe-backup-v15-*.json` file securely. It
   contains sensitive account and business data and is ignored by git.

2. Run schema:

   ```bash
   DATABASE_URL="postgres://..." npm run db:schema
   ```

3. Import a fresh admin backup:

   ```bash
   DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v15.json --replace --confirm-replace --confirm-database=VERIFY_DATABASE_NAME
   ```

4. Verify counts and integrity:

   ```bash
   DATABASE_URL="postgres://..." npm run db:smoke -- ./krishoe-backup-v15.json
   ```

## App Preview Checks

Set preview env:

```bash
DATA_BACKEND=postgres
DATABASE_URL="postgres://..."
```

Then verify these flows:

- Public shop/product pages load real product data.
- Customer register, login, profile update, logout, and password reset work.
- Checkout creates an order and admin can update order/payment status.
- Admin order payment history records amount, provider, references, and optional ledger link.
- Contact form creates a message and admin can update message status.
- Admin product create/edit/delete works.
- Admin operations create/edit/delete works for stock movement and ledger transaction.
- `/api/admin/backup` exports successfully from Postgres.
- Confirm all 12 production-accounting, 7 Factory, uploaded-image, order-line,
  and purchase-line counts match backup v15.
- Run `npm run db:smoke -- ./krishoe-backup-v15.json` again after write tests.

Only switch production after preview checks pass.
