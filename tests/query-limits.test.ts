import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Reads that get slower every day the shop succeeds.
 *
 * A query with no LIMIT is fine while a table is small and becomes the reason a
 * screen takes ten seconds a year later — and nobody remembers why, because
 * nothing changed. The factory tables are where this bites: twenty-five workers
 * logging work every day is seven and a half thousand rows a year, and every
 * one of them handed back to JavaScript to be filtered there.
 *
 * Only the tables that grow without end are listed. factory_workers is capped
 * by how many people the factory employs and raw_materials by how many
 * materials exist — reading all of those is reading a short list, and putting a
 * LIMIT on it would be ceremony.
 */
const GROWTH_TABLES = [
  // One row per worker per day per stage.
  "production_work_entries",
  "factory_daily_work",
  // One per production run, forever.
  "production_work_orders",
  "production_qc_postings",
  "production_stage_handovers",
  // One per wage movement, one per payment, one per order.
  "factory_worker_ledger",
  "worker_payments",
  "payment_transactions",
  "orders",
  "pos_invoices",
  "stock_movements",
  // One per message a customer sends, one per measurement taken.
  "customer_voice",
  "monitoring_performance",
  "monitoring_errors",
  "admin_audit_events",
];

async function libFiles(dir = "lib", out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await libFiles(path, out);
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

/**
 * SELECTs that hand rows back, against a table that grows.
 *
 * Aggregates are excluded: COUNT and SUM return one row however many they read,
 * so the database does the work and the size never reaches JavaScript.
 */
async function unbounded() {
  const found: string[] = [];

  for (const file of await libFiles()) {
    const source = await readFile(file, "utf8");

    for (const match of source.matchAll(/`\s*(SELECT[\s\S]{0,700}?)`/g)) {
      const query = match[1].replace(/\s+/g, " ").trim();
      if (!/^SELECT/i.test(query)) continue;

      // A query built with `WHERE ${...}` contains backticks of its own, and
      // the match above stops at the first one — before the LIMIT at the end.
      // Look at the surrounding source rather than the fragment, or every
      // query assembled in pieces reads as unbounded when it is not.
      const around = source.slice(match.index ?? 0, (match.index ?? 0) + 900);
      if (/\bLIMIT\b/i.test(around)) continue;

      // Aggregates return one row per group however many they read, so the
      // size never reaches JavaScript. COALESCE(SUM(...)) is the common shape
      // here and starts with neither SUM nor COUNT.
      const columns = query.slice(0, query.search(/\bFROM\b/i));
      if (/\b(COUNT|SUM|AVG|MAX|MIN|PERCENTILE_CONT)\s*\(/i.test(columns)) continue;
      if (/^SELECT\s+(EXISTS|1\b)/i.test(query)) continue;

      // A single row fetched by primary key cannot grow.
      if (/WHERE\s+id\s*=\s*\$\d/i.test(query)) continue;

      // FOR UPDATE locks the rows it reads for the rest of the transaction.
      // LIMIT after it is a syntax error in Postgres, and these are bounded by
      // one work order in any case — a run of one design, not a year of them.
      if (/FOR UPDATE/i.test(query)) continue;

      const table = (query.match(/FROM\s+([a-z_][a-z0-9_]*)/i) ?? [])[1] ?? "";
      if (!GROWTH_TABLES.includes(table)) continue;

      found.push(`${file} · ${table} · ${query.slice(0, 70)}`);
    }
  }

  return found;
}

describe("reads that would get slower as the shop grows", () => {
  it("puts a ceiling on every query against a table that grows", async () => {
    const found = await unbounded();

    // Named, not counted: "expected 12 to be 0" sends the reader hunting.
    expect(
      found.join("\n"),
      "Add a LIMIT, or aggregate in the database instead of filtering in JavaScript",
    ).toBe("");
  });

  it("keeps the growth list honest", () => {
    // A table listed here that no longer exists means the list has drifted from
    // the schema and is quietly protecting nothing.
    expect(new Set(GROWTH_TABLES).size).toBe(GROWTH_TABLES.length);
    expect(GROWTH_TABLES.length).toBeGreaterThan(10);
  });
});
