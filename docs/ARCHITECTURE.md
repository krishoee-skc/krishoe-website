# KRISHOE architecture boundaries

## Runtime modes

- **Production:** `DATA_BACKEND=postgres`. Data-bearing domain stores use
  PostgreSQL.
- **Development and CI:** `DATA_BACKEND=local-json`. This is intentional: CI
  has no database credentials and must never reach the live Neon database.
- The selector is `runWithDataBackend` in `lib/data-backend.ts`. New or changed
  domain behavior must put its local and PostgreSQL implementations behind that
  boundary; application pages and route handlers should call the domain API,
  not `queryPostgres` directly.

The current supported stores are listed by `getSafeDataBackendStatus()`. Add a
PostgreSQL implementation and its migration before declaring a new store
complete.

## Code layers

1. `app/` owns routes, metadata, rendering and HTTP boundaries.
2. `components/` owns client interaction and presentation. Storefront-only
   client utilities are centrally mounted by `StorefrontEnhancements`; private
   routes do not load marketing analytics, chat, PWA prompts or storefront
   navigation.
3. `lib/` owns domain rules, authorization checks, persistence adapters and
   external-service integrations.
4. `scripts/` owns explicit operator actions such as schema migrations,
   backups and production integrity checks. They are never part of a normal
   build.

## Incremental refactoring rule

The operations, accounting and notification modules are mature, high-impact
business code. Do not split them merely to reduce line counts. When changing a
large module, move one coherent capability at a time into:

1. a repository/query module;
2. pure validation or calculation rules with focused tests;
3. a service/action that coordinates authorization and the repository; and
4. a page or component that presents the result.

Keep the exported public function as a compatibility seam until callers have
migrated. For money, inventory, payroll, orders and audit events, add a
behavioral test before moving code and retain an auditable transaction boundary.

## Verification levels

- `npm run check` — TypeScript, lint, unit/integration tests and a database-free
  production build.
- `npm run test:e2e` — Chromium shopper journey and unauthenticated-admin guard;
  builds first, then starts the app with `DATA_BACKEND=local-json`.
- `npm run db:smoke`, schema/migration and production-integrity scripts — run
  deliberately against an authorized non-production or production environment.

## Deferred route-layout migration

The shared root layout still owns common server providers. A full storefront /
admin root-layout split would move many routes and test paths, so it needs a
dedicated compatibility migration. The immediate, safe boundary is that
storefront-only client enhancements are gated off private app routes.
