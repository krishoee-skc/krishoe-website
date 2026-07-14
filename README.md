# KRISHOE Website / Web App

Premium KRISHOE footwear storefront built with Next.js App Router.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Important Commands

```bash
npm run lint
npm run build
```

## Admin

- Admin route: `/admin`
- Login route: `/admin/login`
- Copy `.env.example` to `.env.local` and set a strong `ADMIN_PASSWORD` plus a long `ADMIN_SESSION_SECRET`.
- Admin APIs, backup, product export, orders, and messages are protected.

## Production Notes

- Public health check: `/api/health`
- Protected readiness report: `/api/admin/readiness`
- Backup export: `/api/admin/backup`
- Payment gateway sandbox plan: [docs/payment-gateway-plan.md](docs/payment-gateway-plan.md)
- Full launch checklist: [docs/production-checklist.md](docs/production-checklist.md)

Local JSON persistence is useful for development. Before high traffic production,
connect a real database and payment/notification providers using the env vars in
`.env.example`.
