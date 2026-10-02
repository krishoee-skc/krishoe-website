import { createHash } from "node:crypto";
import { getDataBackendConfig } from "@/lib/data-backend";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Three tables for the worker app (owner, 2026-10-02: "the worker sends a photo
 * of their work; a worker on leave; tell me when the sum does not add up").
 * Added only — nothing existing is touched — and only when the Owner presses
 * OK in Settings, the same way the cheque book's table was added.
 *
 *   factory_worker_photos    a photo a worker sends of their work, and what
 *                            the owner did with it (seen, added to the books)
 *   factory_worker_requests  "the sum is wrong" and "an advance, please",
 *                            with the owner's answer
 *   factory_worker_leave     who is away right now — a row while away, gone
 *                            when back; the worker stays active on the books
 */

const STORE = "worker portal";

export const workerPortalMigrations = [
  {
    name: "20261002_factory_worker_photos",
    table: "factory_worker_photos",
    label: { en: "Work photos sent by workers", ne: "कामदारले पठाएका कामका फोटो" },
    sql: `
CREATE TABLE IF NOT EXISTS factory_worker_photos (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  staff_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  pairs INTEGER CHECK (pairs IS NULL OR pairs > 0),
  note TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_worker_photos_kind_check CHECK (kind IN ('done', 'upper', 'ready', 'problem')),
  CONSTRAINT factory_worker_photos_status_check CHECK (status IN ('new', 'seen', 'added'))
);
CREATE INDEX IF NOT EXISTS factory_worker_photos_created_idx ON factory_worker_photos (created_at DESC);
CREATE INDEX IF NOT EXISTS factory_worker_photos_worker_idx ON factory_worker_photos (worker_id, created_at DESC);
`,
  },
  {
    name: "20261002_factory_worker_requests",
    table: "factory_worker_requests",
    label: { en: "Workers' questions and advance requests", ne: "कामदारका हिसाब-प्रश्न र पेस्की माग" },
    sql: `
CREATE TABLE IF NOT EXISTS factory_worker_requests (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES factory_workers(id) ON DELETE RESTRICT,
  staff_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  amount NUMERIC(12, 2) CHECK (amount IS NULL OR amount > 0),
  about_date DATE,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT NOT NULL DEFAULT '',
  resolved_by TEXT NOT NULL DEFAULT '',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factory_worker_requests_kind_check CHECK (kind IN ('hisab', 'advance')),
  CONSTRAINT factory_worker_requests_status_check CHECK (status IN ('open', 'done', 'declined'))
);
CREATE INDEX IF NOT EXISTS factory_worker_requests_created_idx ON factory_worker_requests (created_at DESC);
`,
  },
  {
    name: "20261002_factory_worker_leave",
    table: "factory_worker_leave",
    label: { en: "Who is on leave", ne: "को बिदामा छ" },
    sql: `
CREATE TABLE IF NOT EXISTS factory_worker_leave (
  worker_id TEXT PRIMARY KEY REFERENCES factory_workers(id) ON DELETE RESTRICT,
  since DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT NOT NULL DEFAULT '',
  set_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  },
] as const;

export type WorkerPortalTable = (typeof workerPortalMigrations)[number]["table"];

function checksum(sql: string) {
  return createHash("sha256").update(sql).digest("hex");
}

export type WorkerPortalDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

/** Which of the three tables the live database still lacks. */
export async function workerPortalDatabaseStatus(): Promise<WorkerPortalDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: false, pending: [] };
  const rows = await queryPostgres<{ table_name: string }>(
    STORE,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [workerPortalMigrations.map((migration) => migration.table)],
  );
  const present = new Set(rows.map((row) => row.table_name));
  const pending = workerPortalMigrations
    .filter((migration) => !present.has(migration.table))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

const readyAt = new Map<string, boolean>();
const checkedAt = new Map<string, number>();
const RECHECK_MS = 60_000;

/** Whether one table is there — remembered for a minute, so a page does not ask on every view. */
export async function workerTableReady(table: WorkerPortalTable): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (readyAt.get(table) === true) return true;
  if (readyAt.get(table) === false && Date.now() - (checkedAt.get(table) ?? 0) < RECHECK_MS) return false;
  try {
    const { pending } = await workerPortalDatabaseStatus();
    const name = workerPortalMigrations.find((migration) => migration.table === table)?.name;
    const ready = !pending.some((item) => item.name === name);
    readyAt.set(table, ready);
    checkedAt.set(table, Date.now());
    return ready;
  } catch {
    return false;
  }
}

/** Adds the tables, stamped as applied. Safe to press twice. */
export async function prepareWorkerPortalDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await workerPortalDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = workerPortalMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
  await transactionPostgres(STORE, async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    for (const migration of toApply) {
      await db.query(migration.sql);
      await db.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
        [migration.name, checksum(migration.sql)],
      );
    }
  });
  readyAt.clear();
  return { applied: toApply.map((migration) => migration.name) };
}
