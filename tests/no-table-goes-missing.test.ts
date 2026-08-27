import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every table a query names has to exist in the schema.
 *
 * This test exists because of a mistake. Removing the HR module, I dropped
 * `vehicle_dispatches` alongside it — verified empty, verified unreferenced by
 * the two directories I happened to grep. `lib/operations-postgres.ts` reads it
 * on every dashboard, dues, stock, POS, purchasing, insights and operations
 * load, and I had not looked there. Seven screens and the daily email went down
 * until the tables were put back.
 *
 * "Is it empty" was the wrong question. "Does anything still ask for it" is the
 * right one, and it is a question a machine should answer, every run, not a
 * person from memory at midnight.
 *
 * `docs/schema.sql` is the authority: it is what a fresh database is built
 * from, so a table missing from it is a table that will be missing in fact.
 */

const SOURCE_DIRS = ["app", "lib", "components"];

/**
 * Names that follow FROM/JOIN/INTO/UPDATE but are not tables.
 *
 * CTEs and aliases (`WITH links AS (...) ... FROM links`), Postgres' own
 * catalogue, and the JS that happens to read like SQL.
 */
const NOT_A_TABLE = new Set([
  // Postgres catalogue and metadata.
  "pg_tables", "pg_class", "pg_namespace", "pg_policies", "pg_indexes",
  "information_schema", "pg_catalog", "pg_stat_user_tables",
  // Postgres' own, not the shop's: pg_roles answers whether the connecting
  // role bypasses row-level security, which is what decides whether branch
  // isolation is doing anything; pg_proc and pg_constraint name the rules a
  // refusal came from.
  "pg_roles", "pg_proc", "pg_constraint",
  // SQL keywords that follow FROM/UPDATE in the shapes used here.
  "lateral", "set", "of", "your", "balanced",
  // Common table expressions and derived-table aliases used across the app.
  "links", "item", "earned", "paid", "people", "available_rates", "date_range",
  "dates", "totals", "latest", "ranked", "counted", "matched", "windowed",
  "current", "previous", "combined", "summary", "base", "filtered", "sizes",
  "today_work", "stage_totals", "entries", "work", "rows", "src", "target",
  "unnest", "generate_series", "jsonb_array_elements", "jsonb_each",
]);

/**
 * Tables the code queries that have never existed anywhere — not in the schema,
 * not in a migration, not in the live database.
 *
 * Every one of these is a code path that would throw the moment it ran. They
 * are recorded rather than ignored: this list may only ever get shorter, and a
 * new name appearing here fails the test rather than joining the pile.
 */
const NEVER_EXISTED: Record<string, string> = {
  customers:
    "lib/customer-engagement-gateway.ts — the shop keeps customers in customer_ledgers and users; this table was never created.",
  notification_preferences: "lib/customer-engagement-gateway.ts — an engagement feature that was written but never given a schema.",
  customer_orders: "lib/customer-engagement-gateway.ts — same feature.",
  customer_feedback: "lib/customer-engagement-gateway.ts — same feature.",
  customer_notifications: "lib/customer-engagement-gateway.ts — same feature.",
  customer_loyalty: "lib/customer-engagement-gateway.ts — same feature.",
  user_feedback: "lib/feedback.ts — the customer voice runs on customer_voice instead.",
  whatsapp_messages: "lib/whatsapp-gateway.ts — WhatsApp was never wired up; nothing has ever written a row.",
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry)) out.push(path.split("\\").join("/"));
  }
  return out;
}

/** Strips comments, so a table named only in prose is not counted as used. */
function withoutComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*--.*$/gm, "");
}

/**
 * Just the SQL.
 *
 * "FROM" is an ordinary English word — this app says "Came from seeing a post"
 * and "Straight from the floor" on its own screens — so a bare search for
 * FROM/UPDATE finds sentences, not queries. Only backtick strings that actually
 * contain a SQL verb are searched.
 */
function sqlStrings(source: string) {
  return [...source.matchAll(/`([^`]*)`/g)]
    .map((m) => m[1])
    .filter((text) => /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(text));
}

describe("no table goes missing", () => {
  const schema = readFileSync("docs/schema.sql", "utf8");

  // Both authorities. A fresh database is built from docs/schema.sql and then
  // walked forward through scripts/migrations, so a table created by either one
  // is a table that exists.
  const migrations = readdirSync("scripts/migrations")
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(join("scripts/migrations", name), "utf8"))
    .join("\n");

  const declared = new Set(
    [...`${schema}\n${migrations}`.matchAll(
      /CREATE TABLE(?: IF NOT EXISTS)? ([a-z_][a-z0-9_]*)/gi,
    )].map((m) => m[1].toLowerCase()),
  );

  /** Every table name a query in the app reaches for, and where it was seen. */
  const asked = new Map<string, string>();
  for (const file of SOURCE_DIRS.flatMap((d) => sourceFiles(d))) {
    for (const sql of sqlStrings(withoutComments(readFileSync(file, "utf8")))) {
      for (const match of sql.matchAll(
        /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?([a-z_][a-z0-9_]*)"?/gi,
      )) {
        const table = match[1].toLowerCase();
        if (NOT_A_TABLE.has(table)) continue;
        if (!asked.has(table)) asked.set(table, file);
      }
    }
  }

  it("finds a definition for every table the app queries", () => {
    const missing = [...asked]
      .filter(([table]) => !declared.has(table) && !(table in NEVER_EXISTED))
      .map(([table, file]) => `  ${table}  — asked for in ${file}`);

    expect(
      missing,
      "Queried, but defined in neither docs/schema.sql nor a migration.\n" +
        "Either the query is wrong, or a table was dropped while something\n" +
        "still reads it:\n" +
        missing.join("\n"),
    ).toEqual([]);
  });

  it("keeps the never-existed list honest — one that gets a schema comes off", () => {
    const nowReal = Object.keys(NEVER_EXISTED).filter((table) => declared.has(table));

    expect(
      nowReal,
      `These now have a schema — delete them from NEVER_EXISTED:\n${nowReal.join("\n")}`,
    ).toEqual([]);
  });

  it("still declares the tables the operations snapshot reads on every screen", () => {
    // Named one by one, not counted: getOperationsData() fans out to all of
    // these in a single Promise.all, and losing any one of them takes the
    // dashboard, dues, stock, POS, purchasing, insights and operations down
    // together. This is the specific failure that made this file necessary.
    for (const table of [
      "production_batches",
      "material_consumptions",
      "finished_stock",
      "vehicle_dispatches",
      "vehicle_dispatch_items",
      "customer_ledgers",
      "stock_movements",
      "worker_tasks",
    ]) {
      expect(declared.has(table), `docs/schema.sql declares ${table}`).toBe(true);
    }
  });
});
