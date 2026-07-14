# Postgres Preview Smoke Test Checklist

Use this checklist only against a preview database first.

## Database Checks

1. Export and validate a fresh local backup:

   ```bash
   npm run backup:export -- --url=http://localhost:3002
   ```

   Store the generated `backups/krishoe-backup-v13-*.json` file securely. It
   contains sensitive account and business data and is ignored by git.

2. Run schema:

   ```bash
   DATABASE_URL="postgres://..." npm run db:schema
   ```

3. Import a fresh admin backup:

   ```bash
   DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v13.json --replace --confirm-replace
   ```

4. Verify counts and integrity:

   ```bash
   DATABASE_URL="postgres://..." npm run db:smoke -- ./krishoe-backup-v13.json
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
- Run `npm run db:smoke -- ./krishoe-backup-v13.json` again after write tests.

Only switch production after preview checks pass.
