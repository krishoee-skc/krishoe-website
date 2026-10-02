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
  {
    // The photo becomes a draft of the day's work (owner, 2026-10-02, "ख"):
    // which shoe it is of, and — once the owner presses ✓ — the work entry it
    // became. Two columns added; nothing existing changes.
    name: "20261002_factory_worker_photos_draft",
    table: "factory_worker_photos",
    column: "work_id",
    label: { en: "Work photos become one-tap work entries", ne: "फोटोबाट एक थिचाइमा काम लेख्ने" },
    sql: `
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS item_id TEXT REFERENCES factory_items(id) ON DELETE RESTRICT;
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS work_id TEXT;
`,
  },
  {
    // Checking a photo (owner, 2026-10-03): work or not, which stage, the day,
    // damaged pairs, a word back to the worker, hidden from the list, and what
    // was done to it and by whom. Columns added; nothing existing changes.
    name: "20261003_factory_worker_photos_review",
    table: "factory_worker_photos",
    column: "history",
    label: { en: "Check a photo: work or not, the stage, the day, a word back", ne: "फोटो जाँच्ने: काम हो कि होइन, चरण, दिन, कामदारलाई जवाफ" },
    sql: `
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS verdict TEXT NOT NULL DEFAULT '';
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS reply TEXT NOT NULL DEFAULT '';
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS work_date DATE;
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS reject_pairs INTEGER;
ALTER TABLE factory_worker_photos ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;
`,
  },
] as const;

export type WorkerPortalTable = (typeof workerPortalMigrations)[number]["table"];
type Migration = (typeof workerPortalMigrations)[number] & { column?: string };

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
  const [rows, columns] = await Promise.all([
    queryPostgres<{ table_name: string }>(
      STORE,
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = ANY($1)`,
      [workerPortalMigrations.map((migration) => migration.table)],
    ),
    queryPostgres<{ table_name: string; column_name: string }>(
      STORE,
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = ANY($1)`,
      [workerPortalMigrations.map((migration) => migration.table)],
    ),
  ]);
  const present = new Set(rows.map((row) => row.table_name));
  const presentColumns = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  // A migration that adds a column is done when that column is there; one that
  // adds a table, when the table is.
  const done = (migration: Migration) =>
    migration.column ? presentColumns.has(`${migration.table}.${migration.column}`) : present.has(migration.table);
  const pending = (workerPortalMigrations as readonly Migration[])
    .filter((migration) => !done(migration))
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
    // The table itself — its first migration, not a later column on it.
    const name = (workerPortalMigrations as readonly Migration[]).find((migration) => migration.table === table && !migration.column)?.name;
    const ready = !pending.some((item) => item.name === name);
    readyAt.set(table, ready);
    checkedAt.set(table, Date.now());
    return ready;
  } catch {
    return false;
  }
}

let draftReady: { value: boolean; at: number } | null = null;

/** Whether a photo can carry its shoe and become a work entry — the fourth migration. */
export async function photoDraftReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (draftReady?.value) return true;
  if (draftReady && Date.now() - draftReady.at < RECHECK_MS) return false;
  try {
    const { pending } = await workerPortalDatabaseStatus();
    const value = !pending.some((item) => item.name === "20261002_factory_worker_photos_draft");
    draftReady = { value, at: Date.now() };
    return value;
  } catch {
    return false;
  }
}

let reviewReady: { value: boolean; at: number } | null = null;

/** Whether a photo can be checked in full — the fifth migration. */
export async function photoReviewReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (reviewReady?.value) return true;
  if (reviewReady && Date.now() - reviewReady.at < RECHECK_MS) return false;
  try {
    const { pending } = await workerPortalDatabaseStatus();
    const value = !pending.some((item) => item.name === "20261003_factory_worker_photos_review");
    reviewReady = { value, at: Date.now() };
    return value;
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
  draftReady = null;
  reviewReady = null;
  return { applied: toApply.map((migration) => migration.name) };
}
