import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * The cash drawer's two numbers a day (owner, 2026-10-29, "garau"): what was in
 * it in the morning, and what was counted at the close. With the Day Book's
 * cash in and out between them, the Transactions page can say what should be
 * in the drawer, and whether the count agrees. The books never kept the
 * morning float, so "cash in hand" could only be "cash in less cash out".
 */
export const cashDayMigrations = [
  {
    name: "20261029_cash_days.sql",
    table: "cash_days",
    label: {
      en: "The cash drawer — the morning's cash and the evening's count, a day each (1 new table)",
      ne: "गल्ला — बिहानको नगद र साँझको गन्ती, दिनको एक लाइन (१ नयाँ तालिका)",
    },
    sql: `-- The cash drawer's two numbers a day (owner, 2026-10-29): the cash in it in
-- the morning, and what was counted at the close. The Transactions page adds
-- the day's cash in and takes away the cash out to say what should be there.
-- One row a Nepal day; either number may be blank until it is written.
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE cash_days).

CREATE TABLE IF NOT EXISTS cash_days (
  day date PRIMARY KEY,
  opening numeric(12, 2) CHECK (opening IS NULL OR opening >= 0),
  counted numeric(12, 2) CHECK (counted IS NULL OR counted >= 0),
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
`,
  },
] as const;

const STORE = "cash days";

let ready: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

export type CashDaysDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

export async function cashDaysDatabaseStatus(): Promise<CashDaysDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const rows = await queryPostgres<{ table_name: string }>(
    STORE,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [cashDayMigrations.map((migration) => migration.table)],
  );
  const present = new Set(rows.map((row) => row.table_name));
  const pending = cashDayMigrations
    .filter((migration) => !present.has(migration.table))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

/** Whether the table is there, remembered for a minute so a page does not ask each time. */
export async function cashDaysReady(): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  if (ready === true) return true;
  if (ready === false && Date.now() - checkedAt < RECHECK_MS) return false;
  ready = (await cashDaysDatabaseStatus().catch(() => ({ ready: false }))).ready;
  checkedAt = Date.now();
  return ready;
}

export async function prepareCashDaysDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await cashDaysDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = cashDayMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
        [migration.name, migrationChecksum(migration.sql)],
      );
    }
  });
  ready = null;
  return { applied: toApply.map((migration) => migration.name) };
}

export type CashDay = { day: string; opening: number | null; counted: number | null; updatedBy: string; updatedAt: string };

/** One day's two numbers, or null where the table is not there yet. */
export async function getCashDay(day: string): Promise<CashDay | null> {
  if (!(await cashDaysReady())) return null;
  const rows = await queryPostgres<{ opening: string | null; counted: string | null; updated_by: string; updated_at: string | Date }>(
    STORE,
    "SELECT opening, counted, updated_by, updated_at FROM cash_days WHERE day = $1::date",
    [day],
  );
  const row = rows[0];
  const at = row?.updated_at;
  return {
    day,
    opening: row?.opening == null ? null : Number(row.opening),
    counted: row?.counted == null ? null : Number(row.counted),
    updatedBy: row?.updated_by ?? "",
    updatedAt: at ? (at instanceof Date ? at.toISOString() : String(at)) : "",
  };
}

/** Write the morning's cash or the evening's count for a day, keeping the other. */
export async function setCashDay(day: string, field: "opening" | "counted", amount: number, by: string) {
  if (!(await cashDaysReady())) throw new Error("The database is not ready for the cash drawer yet. Prepare it in Settings.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Choose a day.");
  if (!(amount >= 0)) throw new Error("The amount cannot be below 0.");
  const column = field === "opening" ? "opening" : "counted";
  await queryPostgres(
    STORE,
    `INSERT INTO cash_days (day, ${column}, updated_by, updated_at)
     VALUES ($1::date, $2, $3, now())
     ON CONFLICT (day) DO UPDATE SET ${column} = EXCLUDED.${column}, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [day, Math.round(amount * 100) / 100, by.slice(0, 80)],
  );
}

export { drawerCheck } from "@/lib/cash-days-rules";
