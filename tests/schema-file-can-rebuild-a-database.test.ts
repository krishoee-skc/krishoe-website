import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * docs/schema.sql must be runnable, not just readable.
 *
 * The live database grew by migration over months, and this file is the
 * written record of what that produced. Neon never ran the file — it ran the
 * migrations — so two faults sat in it unnoticed until a fresh Postgres 17
 * tried to replay it top to bottom and stopped:
 *
 *   1. `factory_workers` was defined at line 1128 but six foreign keys point
 *      at it from line 656 onwards. A fresh database reads in order and has
 *      no table to reference yet.
 *   2. Two tables carried a trailing comma on their last column, the comma
 *      left behind when a CHECK was commented out. Postgres reads `,` then
 *      `)` and refuses the statement.
 *
 * Both were invisible for as long as nobody rebuilt from the file. The day
 * someone does — a new environment, a restore, a move to another host — the
 * file is all there is, so this test reads it the way Postgres would.
 *
 * It does not connect to a database. It checks the two things that make a
 * replay impossible, so a rebuild never fails on a fault this cheap to catch.
 */

async function schemaLines(): Promise<string[]> {
  const source = await readFile("docs/schema.sql", "utf8");
  return source.split(/\r?\n/);
}

describe("the schema file", () => {
  it("defines every table before anything references it", async () => {
    const lines = await schemaLines();

    const created = new Map<string, number>();
    lines.forEach((line, index) => {
      const match = /^CREATE TABLE IF NOT EXISTS (\w+)/.exec(line);
      if (match && !created.has(match[1])) created.set(match[1], index);
    });

    const unresolved: string[] = [];
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/REFERENCES\s+(\w+)\s*\(/g)) {
        const table = match[1];
        const definedAt = created.get(table);
        if (definedAt === undefined) {
          unresolved.push(`line ${index + 1}: ${table} is never created in this file`);
        } else if (definedAt > index) {
          unresolved.push(`line ${index + 1}: ${table} is created later, at line ${definedAt + 1}`);
        }
      }
    });

    expect(unresolved, "a fresh database reads this file once, in order").toEqual([]);
  });

  it("ends every table without a trailing comma", async () => {
    const lines = await schemaLines();

    const trailing: string[] = [];
    lines.forEach((line, index) => {
      if (line.trim() !== ");") return;

      // Walk back past comments and blank lines to the last real column or
      // constraint — that is what the closing paren actually follows.
      let previous = index - 1;
      while (previous >= 0 && (lines[previous].trim().startsWith("--") || !lines[previous].trim())) {
        previous -= 1;
      }
      if (previous >= 0 && lines[previous].trimEnd().endsWith(",")) {
        trailing.push(`line ${previous + 1}: ${lines[previous].trim()}`);
      }
    });

    expect(trailing, "Postgres refuses a comma before the closing paren").toEqual([]);
  });

  it("still records the tables the app needs", async () => {
    const lines = await schemaLines();
    const created = new Set(
      lines.flatMap((line) => {
        const match = /^CREATE TABLE IF NOT EXISTS (\w+)/.exec(line);
        return match ? [match[1]] : [];
      }),
    );

    // A guard on the two tests above: the cheapest way to make them pass is to
    // delete tables. These are load-bearing — wages, stock, orders, staff.
    for (const table of ["factory_workers", "factory_daily_work", "factory_worker_ledger", "products", "orders"]) {
      expect(created, `${table} must stay in the schema file`).toContain(table);
    }
  });
});
