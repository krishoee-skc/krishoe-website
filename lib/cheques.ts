import { getDataBackendConfig } from "@/lib/data-backend";
import { migrationChecksum } from "@/lib/delivery-database";
import type { PosPaymentPart } from "@/lib/pos-payments";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

/**
 * Cheques taken on counter bills, watched until the bank pays them (owner,
 * 2026-09-30). A cheque bill was "Paid" the moment it was saved — Rs. 10,500
 * on 26 Sept — and a bounced cheque would have left the books saying the money
 * was in.
 *
 * The table comes from one Owner button in Settings, the way the counter-goods
 * table did (lib/counter-items-database.ts); the SQL is the migration file
 * word for word. Until it is added, nothing is shown and nothing fails.
 */
export const chequeMigrations = [
  {
    name: "20260930_pos_cheques.sql",
    table: "pos_cheques",
    label: {
      en: "Cheques on bills, until they clear (1 new table)",
      ne: "बिलमा लिएका चेक, नसाटिँदासम्म (१ नयाँ तालिका)",
    },
    sql: `-- Cheques taken on counter bills, until the bank has paid them.
--
-- A bill paid by cheque was marked Paid the moment it was saved, so a cheque
-- that bounced left the books saying the money was in (owner, 2026-09-30).
-- A cheque bill with no row here is waiting to clear. The row says what
-- happened to it:
--
--   state     'cleared'   the bank paid it
--             'bounced'   the bank returned it; the money is still owed
--             'recovered' after a bounce, the money was collected another way
--   noted_by  who said so
--
-- Additive: a new table, nothing existing is changed. Reversible (DROP TABLE).

CREATE TABLE IF NOT EXISTS pos_cheques (
  invoice_id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('cleared', 'bounced', 'recovered')),
  noted_at timestamptz NOT NULL DEFAULT now(),
  noted_by text NOT NULL DEFAULT ''
);
`,
  },
  {
    name: "20261001_cheques.sql",
    table: "cheques",
    label: {
      en: "The cheque book — every cheque taken or given, with its bank and date (1 new table)",
      ne: "चेक खाता — लिएको र दिएको हरेक चेक, बैंक र मितिसहित (१ नयाँ तालिका)",
    },
    sql: `-- Every cheque the shop takes or gives, with its whole story (owner,
-- 2026-10-01): whose it is, which bank, the number, the amount, the date it
-- may be deposited, and what the bank did with it and when.
--
--   direction   'in'   taken from a customer on a counter bill
--               'out'  given to a supplier on a purchase bill
--   source      'bill' | 'purchase' | 'manual', with the bill's or purchase's
--               id in source_id (a manual cheque carries its own id there)
--   state       'waiting'    in hand (in) or handed over (out), not yet cashed
--               'deposited'  put in the bank, the bank still to pay (in only)
--               'cleared'    the bank paid it (in) or the supplier cashed it (out)
--               'bounced'    the bank returned it; the money is still owed
--               'recovered'  after a bounce, the money came in another way
--               'cancelled'  torn, replaced or handed back
--
-- pos_cheques stays as it is and is kept in step for bills, so nothing that
-- reads it changes. Additive: a new table, nothing existing is changed.
-- Reversible (DROP TABLE cheques).

CREATE TABLE IF NOT EXISTS cheques (
  id text PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  source text NOT NULL CHECK (source IN ('bill', 'purchase', 'manual')),
  source_id text NOT NULL,
  source_number text NOT NULL DEFAULT '',
  party_name text NOT NULL DEFAULT '',
  party_phone text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  cheque_no text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  cheque_date date,
  name_on_cheque text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'waiting'
    CHECK (state IN ('waiting', 'deposited', 'cleared', 'bounced', 'recovered', 'cancelled')),
  deposited_on date,
  cleared_on date,
  bounced_on date,
  bounce_reason text NOT NULL DEFAULT '',
  bank_charge numeric(12, 2) NOT NULL DEFAULT 0 CHECK (bank_charge >= 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS cheques_one_per_source ON cheques (source, source_id);
CREATE INDEX IF NOT EXISTS cheques_open_by_date ON cheques (cheque_date)
  WHERE state IN ('waiting', 'deposited', 'bounced');
`,
  },
] as const;

export const chequeStates = ["cleared", "bounced", "recovered"] as const;
export type ChequeState = (typeof chequeStates)[number];

const STORE = "pos cheques";

// Per table: the counter's cheque marks (pos_cheques) work as soon as their
// table is there, whether or not the cheque book's has been added yet.
const readyAt = new Map<string, boolean>();
const checkedAt = new Map<string, number>();
const RECHECK_MS = 60_000;

export type ChequesDatabaseStatus = {
  ready: boolean;
  pending: { name: string; label: { en: string; ne: string } }[];
};

/** Which of the tables the live database still lacks. */
export async function chequesDatabaseStatus(): Promise<ChequesDatabaseStatus> {
  if (getDataBackendConfig().backend !== "postgres") return { ready: true, pending: [] };
  const rows = await queryPostgres<{ table_name: string }>(
    STORE,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ANY($1)`,
    [chequeMigrations.map((migration) => migration.table)],
  );
  const present = new Set(rows.map((row) => row.table_name));
  const pending = chequeMigrations
    .filter((migration) => !present.has(migration.table))
    .map(({ name, label }) => ({ name, label }));
  return { ready: pending.length === 0, pending };
}

async function tableReady(table: string): Promise<boolean> {
  if (getDataBackendConfig().backend !== "postgres") return false;
  const known = readyAt.get(table);
  if (known === true) return true;
  if (known === false && Date.now() - (checkedAt.get(table) ?? 0) < RECHECK_MS) return false;
  const { pending } = await chequesDatabaseStatus();
  const name = chequeMigrations.find((migration) => migration.table === table)?.name;
  const ready = !pending.some((item) => item.name === name);
  readyAt.set(table, ready);
  checkedAt.set(table, Date.now());
  return ready;
}

/** Whether pos_cheques exists. Local files never keep cheques. */
export async function chequesReady(): Promise<boolean> {
  return tableReady("pos_cheques");
}

/** Whether the cheque book's table (cheques) exists. */
export async function chequeBookTableReady(): Promise<boolean> {
  return tableReady("cheques");
}

/** Adds the table, stamped as applied. Safe to press twice. */
export async function prepareChequesDatabase() {
  if (getDataBackendConfig().backend !== "postgres") return { applied: [] as string[] };
  const { pending } = await chequesDatabaseStatus();
  if (!pending.length) return { applied: [] as string[] };
  const toApply = chequeMigrations.filter((migration) => pending.some((item) => item.name === migration.name));
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
  readyAt.clear();
  return { applied: toApply.map((migration) => migration.name) };
}

/** What each cheque bill came to, by bill. Empty when the table is not there. */
export async function getChequeStates(): Promise<Map<string, ChequeState>> {
  if (!(await chequesReady().catch(() => false))) return new Map();
  const rows = await queryPostgres<{ invoice_id: string; state: ChequeState }>(
    STORE,
    "SELECT invoice_id, state FROM pos_cheques",
  );
  return new Map(rows.map((row) => [row.invoice_id, row.state]));
}

/** The bank paid it, or returned it, or the bounced money came in another way. */
export async function setChequeState(invoiceId: string, state: ChequeState, by: string) {
  if (!chequeStates.includes(state)) throw new Error("Unknown cheque state.");
  if (!(await chequesReady())) throw new Error("The database is not ready for cheques yet. Prepare it in Settings.");
  await queryPostgres(
    STORE,
    `INSERT INTO pos_cheques (invoice_id, state, noted_by) VALUES ($1, $2, $3)
     ON CONFLICT (invoice_id) DO UPDATE SET state = EXCLUDED.state, noted_at = now(), noted_by = EXCLUDED.noted_by`,
    [invoiceId, state, by.slice(0, 80)],
  );
}

type ChequeBill = {
  id: string;
  kind: "Sale" | "Return";
  status: string;
  paymentMethod: string;
  paidAmount: number;
  payments?: PosPaymentPart[];
};

/**
 * Rupees a bill took by cheque — its cheque parts toward the bill and old
 * credit, or, on a one-method bill, what it was paid.
 */
export function chequeAmount(invoice: ChequeBill) {
  if (invoice.kind !== "Sale" || invoice.status === "Voided") return 0;
  const parts = invoice.payments ?? [];
  if (parts.length > 0) {
    return parts
      .filter((part) => part.method === "Cheque" && part.purpose !== "refund")
      .reduce((sum, part) => sum + part.amount, 0);
  }
  return invoice.paymentMethod === "Cheque" ? Math.max(0, invoice.paidAmount) : 0;
}

/**
 * The cheque bills still to watch, oldest first: waiting for the bank, or
 * bounced and not yet collected. A cleared or collected cheque leaves the list.
 */
export function chequesToWatch<T extends ChequeBill>(invoices: T[], states: Map<string, ChequeState>) {
  return invoices
    .map((invoice) => ({ invoice, amount: chequeAmount(invoice), state: states.get(invoice.id) }))
    .filter((row) => row.amount > 0 && (row.state === undefined || row.state === "bounced"))
    .map((row) => ({ ...row, state: (row.state ?? "waiting") as "waiting" | "bounced" }))
    .reverse();
}
