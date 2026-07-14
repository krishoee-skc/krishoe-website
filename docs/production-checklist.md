# KRISHOE Production Checklist

Use this list before the final public launch. Keep real secrets only in
`.env.local` locally and in Vercel project environment variables.

## Already Built

- Premium storefront, shop, product detail, cart, wishlist, checkout, contact, about, order status.
- Admin login, signed session cookie, login rate limit, staff role permissions, proxy-level 401/403 protection for mapped admin APIs, activity log filters/search, and CSV audit export for login/logout, backup export, sensitive CSV exports, products, orders, and operations changes.
- Admin/customer login and public submissions use shared rate-limit storage in Postgres production mode.
- Customer register/login/logout, signed session cookie, profile editing, checkout prefill, password reset flow.
- Password reset request flow queues delivery, stores new reset tokens as hashes, and does not expose reset tokens in production UI.
- Admin backup/export and Postgres import hash legacy plaintext reset tokens before they leave or enter storage.
- Logged-in customer password change with current-password verification.
- Customer account order history linked by account email or saved phone number.
- Logged-in checkout orders are linked to the customer account id for stronger order history and privacy matching.
- Public order status pages hide customer PII, item details, totals, and payment references unless the signed-in account matches the order email or phone.
- Product CMS with local JSON persistence, edit/delete controls, and product CSV export.
- Product review moderation with approve/reject/delete controls, CSV export, and audit trail.
- Admin message inbox with reply/reopen status controls, CSV export, and audit trail.
- Operations dashboard for raw material, worker tasks, production batches, finished stock, vehicle dispatch, stock movement, customer ledger, and ledger transaction history.
- POS/e-billing foundation for retail, wholesale, and online invoices with item lines, printable receipts, stock movement posting, credit ledger posting, scannable barcode/QR SVGs, camera scanner lookup, and CSV export.
- Purchasing foundation for raw material purchase invoices, supplier ledger, supplier payments, supplier due, raw material received posting, purchase CSV export, and purchase-basis profit signal.
- COGS/design profit report for material average cost, labor rates, overhead/electricity/rent allocation, production batch cost, POS revenue, daily/monthly/yearly gross profit, margin signal, and CSV exports.
- HR foundation for employee master data, employee HR profile pages, edit/status/delete controls, attendance edit forms, fingerprint device id mapping, fingerprint CSV attendance import with result feedback and error detail, duplicate-safe payroll records, payroll approve/pay/lock workflow, auto salary draft suggestions, monthly salary closing with print report, printable salary slips, worker-task performance, station headcount, monthly reports, and HR CSV exports.
- Customer ledger detail pages with transaction history and printable ledger view.
- Protected order/message inbox APIs and exports.
- Security headers are configured in `next.config.js`: no powered-by header, frame deny, nosniff, strict referrer policy, permissions policy, COOP/CORP, and production HSTS.
- SEO/PWA basics: sitemap, robots, manifest, metadata, Open Graph.
- Public customer submission rate limit and notification delivery queue with retry/export controls.
- Public health endpoint: `/api/health`.
- Protected readiness endpoint: `/api/admin/readiness`.
- Branded 404 and error fallback UI.

## Required Before Real Production

1. Real database
   - Choose one: Supabase/Postgres, Sanity, Shopify, or another managed database.
   - Add `DATA_BACKEND` and `DATABASE_URL` in Vercel.
   - Export `/api/admin/backup` before migration. This backup contains sensitive user password hashes and account data, so store it securely.
   - Local helper: run `npm run backup:export -- --url=http://localhost:3002`; generated files stay under ignored `backups/`.
   - Run `docs/schema.sql` against a clean Postgres database.
   - Follow `docs/postgres-migration-plan.md`.
   - Confirm the completed repository adapters listed in `docs/postgres-adapter-scaffold.md` still match the live schema before switching traffic.
   - Migrate current `data/products.json`, `data/orders.json`, `data/messages.json`, `data/users.json`, `data/operations.json`, `data/pos-invoices.json`, `data/purchases.json`, `data/costing-settings.json`, `data/hr.json`, hashed password reset tokens if still needed, and admin audit data.
   - Compare imported row counts against `backup.counts` and resolve any `backup.integrity` issue before switching traffic.
   - Switch `DATA_BACKEND=postgres` only after preview read/write smoke tests pass.

2. Payment gateway
   - Create merchant account for eSewa and/or Khalti.
   - Keep `PAYMENT_MODE=manual` until sandbox testing starts.
   - Add sandbox keys first: `PAYMENT_MODE=sandbox`, `ESEWA_MERCHANT_ID`, `ESEWA_SECRET_KEY`, `KHALTI_SECRET_KEY`.
   - Use `docs/payment-gateway-plan.md` to test the sandbox-safe initiate and callback routes.
   - eSewa sandbox callback signature verification is present; enable `ESEWA_VERIFY_WITH_STATUS_CHECK=true` in preview when status-check testing is ready.
   - Implement remaining official provider verification adapters before `PAYMENT_MODE=live`.
   - Test failed payment, cancelled payment, duplicate callback, amount mismatch, missing order, and successful payment.

3. Email/SMS notifications
   - Pick a webhook automation provider, generic HTTP email provider, or Nepal-compatible SMS HTTP provider.
   - For quick automation, set `NOTIFICATION_WEBHOOK_URL` to Make/Zapier/n8n and forward order/contact events.
   - For email HTTP delivery, add `EMAIL_PROVIDER_URL`, optional `EMAIL_PROVIDER_TOKEN`, and `ADMIN_NOTIFICATION_EMAIL`.
   - Keep `PASSWORD_RESET_SHOW_LOCAL_LINK=false` in production; set `EMAIL_PROVIDER_URL` so customer password reset links can be delivered by email.
   - For SMS HTTP delivery, add `SMS_PROVIDER_URL`, optional `SMS_PROVIDER_TOKEN`, and `ADMIN_NOTIFICATION_PHONE`.
   - Verify `/admin/notifications`, manual retry, CSV export, and `/api/admin/notifications/deliver` in preview.

4. Vercel production setup
   - Set every env var from `.env.example` in Vercel Production and Preview.
   - Create at least one active Owner staff account in `/admin/settings`; use bootstrap `ADMIN_PASSWORD` only for setup/recovery.
   - Set `ADMIN_ROLE` deliberately. Use `Owner` only for the main owner account; use narrower roles for staff-facing deployments.
   - Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain.
   - Attach the final domain and verify DNS.
   - Run `npm run build` locally before deploy.
   - Run `npm audit` and confirm high/critical vulnerabilities are zero.
   - After deploy, verify `/`, `/shop`, `/product/[id]`, `/checkout`, `/api/health`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`.

5. Final mobile/browser QA
   - Test 390px mobile, 768px tablet, and 1440px desktop.
   - Check navbar/mobile menu, shop filters, product gallery, cart/wishlist persistence, checkout form, order status, contact form, and admin login.
   - Confirm no horizontal scroll, clipped buttons, overlapping text, broken images, or slow route transitions.
   - Confirm admin APIs return `401` when logged out and work only after admin login.
