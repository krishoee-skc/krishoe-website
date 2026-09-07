# KRISHOE engineering status

**Last reviewed:** 2026-09-07

This document describes repository health, not a claim about a live deployment.
For the historical reports previously used as status pages, see
[APP_STATUS.md](APP_STATUS.md) and [REMAINING_WORK_STATUS.md](REMAINING_WORK_STATUS.md).

## Current operating model

- Production data is selected with `DATA_BACKEND=postgres`.
- Local development, CI and browser tests select `DATA_BACKEND=local-json` and
  must not need `DATABASE_URL`.
- Storefront product data hydrates published reviews in its grouped product
  query; the product page does not make an additional per-product review query.
- Customer voice now follows the same local/PostgreSQL data-backend contract,
  including the one-review-per-order-and-product invariant.
- Storefront-only client services are not mounted on admin, worker, account or
  customer routes.

## Required checks before merging

```sh
npm run check
npm run test:e2e
```

`test:e2e` builds first, then runs Chromium against the optimized production
server. The GitHub Actions pipeline builds once before running Playwright with
placeholder session values and without database credentials.

## Operational checks (explicit, credentialed)

Run migration, backup and database smoke scripts only in an environment that is
authorized for the target database. They are intentionally separate from CI:

```sh
npm run db:smoke
npm run audit:production
```

Do not paste `.env.local` values into documentation, issues or browser tests.

## Known follow-up work

- Complete the route-group/root-layout migration only as a dedicated change with
  compatibility coverage.
- Incrementally split the large financial and operations modules using the
  boundary rules in [ARCHITECTURE.md](ARCHITECTURE.md).
- Review dependency audit findings during dependency maintenance; package audit
  results are environment-specific and must be checked at update time.
