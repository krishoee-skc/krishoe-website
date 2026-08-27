/**
 * What the database actually said, in words a shopkeeper can act on.
 *
 * Every piece-rate work entry was refused for weeks and all anyone was told was
 * "Failed to create work entry". The real answer was in the error the whole
 * time: a CHECK constraint on factory_monthly_summary.month, refusing the
 * Bikram Sambat month start the app had begun writing. The route caught it,
 * saw it was not one of its own FactoryMutationErrors, and replaced it with a
 * sentence of its own that named nothing.
 *
 * A refusal from Postgres is not an unknown failure. It carries a code, the
 * table, the constraint and often the failing row, and every one of those is
 * more use than "failed". This turns them into a sentence — and, where the
 * constraint is one this shop has met before, into the sentence that says what
 * to do about it.
 *
 * Nothing here talks to a database or throws; it only reads an error.
 */

/** The fields node-postgres puts on a rejection. Everything is optional. */
type PostgresError = {
  code?: string;
  message?: string;
  detail?: string;
  table?: string;
  column?: string;
  constraint?: string;
  schema?: string;
};

function asPostgresError(error: unknown): PostgresError | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as PostgresError;
  // A pg error always carries a five-character SQLSTATE. Anything without one
  // is an ordinary JavaScript error and is not ours to explain.
  return typeof candidate.code === "string" && candidate.code.length === 5 ? candidate : null;
}

/**
 * Constraints this shop has actually been stopped by, and what they mean.
 *
 * Not a translation of every rule in the schema — that list would rot. These
 * are the ones somebody has hit, written the day they hit them, so the next
 * person reads an answer instead of a name.
 */
const KNOWN: Record<string, string> = {
  factory_monthly_summary_month_check:
    "The monthly summary refused this month. A Bikram Sambat month starts mid-Gregorian-month, and the database was still demanding the first — run the pending migrations.",
  factory_daily_work_status_check:
    "That work status is not one the database allows. It takes in_progress, completed or rework.",
  purchase_invoices_payment_method_check:
    "That payment method is not one the database allows for a purchase. Run the pending migrations if you are adding a new one.",
  supplier_transactions_type_check:
    "That supplier transaction type is not one the database allows. Run the pending migrations if you are adding a new one.",
  pos_invoices_submission_key_idx:
    "This bill was already saved. Open the invoice list rather than saving it twice.",
  stock_locations_design_size_run_location_key:
    "That shoe already has a count at that place. Change the count rather than adding a second one.",
};

const BY_CODE: Record<string, (error: PostgresError) => string> = {
  // 23514 check_violation
  "23514": (error) =>
    error.constraint && KNOWN[error.constraint]
      ? KNOWN[error.constraint]
      : `The database refused this: it breaks the rule ${error.constraint ?? "on that table"}${
          error.table ? ` on ${error.table}` : ""
        }.`,
  // 23505 unique_violation
  "23505": (error) =>
    error.constraint && KNOWN[error.constraint]
      ? KNOWN[error.constraint]
      : `That already exists${error.table ? ` in ${error.table}` : ""} — it cannot be saved twice.`,
  // 23503 foreign_key_violation
  "23503": (error) =>
    `This points at something that is not there${
      error.table ? ` (${error.table})` : ""
    }. It may have been deleted while this was open.`,
  // 23502 not_null_violation
  "23502": (error) =>
    `${error.column ?? "A required field"} was left empty${error.table ? ` on ${error.table}` : ""}.`,
  // 42703 undefined_column, 42P01 undefined_table
  "42703": (error) =>
    `The database has no ${error.message?.match(/column "([^"]+)"/)?.[1] ?? "such column"} — the app is expecting a change that has not been applied. Run the pending migrations.`,
  "42P01": () =>
    "The database is missing a table the app expects. Run the pending migrations.",
};

/**
 * A sentence for the person who pressed the button, or null when the error is
 * not the database's.
 */
export function describeDatabaseRefusal(error: unknown): string | null {
  const pgError = asPostgresError(error);
  if (!pgError) return null;

  const describe = BY_CODE[pgError.code as string];
  if (describe) return describe(pgError);

  // An unmapped SQLSTATE still beats "failed": the code is searchable and the
  // table names the place.
  return `The database refused this (${pgError.code})${pgError.table ? ` on ${pgError.table}` : ""}.`;
}

/**
 * Everything worth writing down about a refusal.
 *
 * Handed to reportError so the log carries the constraint and the failing row,
 * not just a message. The row detail is what turned "some check failed" into
 * "it was the month, and the month was 2026-08-17".
 */
export function databaseRefusalDetail(error: unknown) {
  const pgError = asPostgresError(error);
  if (!pgError) return null;

  return {
    code: pgError.code,
    table: pgError.table,
    column: pgError.column,
    constraint: pgError.constraint,
    detail: pgError.detail,
    message: pgError.message,
  };
}

/**
 * The message to show, whatever the error turns out to be.
 *
 * Prefers the database's own explanation, falls back to the caller's sentence.
 * Callers that already speak for themselves — a FactoryMutationError, a
 * validation error — should be handled before this is reached.
 */
export function refusalMessage(error: unknown, fallback: string) {
  return describeDatabaseRefusal(error) ?? fallback;
}
