import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Supabase's public roles lose their table grants, from one Owner button
 * (owner, 2026-10-28, KR-SEC-02). The button runs the SQL of
 * scripts/migrations/20261028_public_roles_no_table_grants.sql word for word.
 *
 * Row-level security already keeps anon and authenticated out of every table;
 * this is the second lock, so a table left without RLS one day is still shut.
 * The app does not use these roles, so nothing it does changes.
 */
export const publicRolesMigration = {
  name: "20261028_public_roles_no_table_grants.sql",
  label: {
    en: "Shut the tables to Supabase's public roles (anon, authenticated) — a second lock behind row-level security",
    ne: "Supabase का सार्वजनिक role (anon, authenticated) लाई table बाट हटाउने — RLS पछाडिको दोस्रो ताला",
  },
  sql: `-- The shop's tables are shut to Supabase's public roles at the door, not only
-- by row-level security (owner, 2026-10-28, KR-SEC-02 of the security check).
--
-- Every table has row-level security on and no policy, so anon and
-- authenticated already read nothing. They still held table grants, though:
-- one table with RLS switched off by mistake would have been readable by
-- anyone holding the project's public key. The app never uses these roles —
-- it talks to the database as its own user — so taking the grants away
-- changes nothing it does. No row is touched, nothing is dropped. Safe to run
-- twice; a database without these roles (a local copy) is left as it is.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END
$$;
`,
} as const;

const STORE = "public roles";

export type PublicRolesStatus = {
  ready: boolean;
  /** Tables the public roles may still read. */
  open: number;
  label: { en: string; ne: string };
};

/** Whether anon or authenticated can still read any table. Ready off Postgres, or without the roles. */
export async function publicRolesStatus(): Promise<PublicRolesStatus> {
  const label = publicRolesMigration.label;
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, open: 0, label };
  const rows = await queryPostgres<{ open: number | string }>(
    STORE,
    `SELECT count(*)::int AS open
       FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        AND (has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT'))`,
  );
  const open = Number(rows[0]?.open ?? 0);
  return { ready: open === 0, open, label };
}

/** Takes the grants away, stamped as applied. Safe to press twice. */
export async function preparePublicRoles() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: false };
  const { ready } = await publicRolesStatus();
  if (ready) return { applied: false };
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(publicRolesMigration.sql);
    await db.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
      [publicRolesMigration.name, migrationChecksum(publicRolesMigration.sql)],
    );
  });
  return { applied: true };
}
