import { readdir, readFile } from "node:fs/promises";
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

  it("records every table the migrations created and never dropped", async () => {
    // The snapshot is kept by hand while the migrations run themselves, so it
    // drifts silently: twelve tables added between August and September were
    // never copied in, including customer_voice, which every review reads, and
    // admin_passkeys, which signs the owner in. A database built from the file
    // alone came up missing them and those screens failed.
    //
    // Derived from the migrations rather than a list written here, so the next
    // table someone adds is held to the same rule without anybody remembering
    // to update this test.
    const directory = "scripts/migrations";
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql"));

    const createdByMigration = new Map<string, string>();
    const dropped = new Set<string>();

    for (const name of files) {
      const sql = await readFile(`${directory}/${name}`, "utf8");
      for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
        if (!createdByMigration.has(match[1])) createdByMigration.set(match[1], name);
      }
      for (const match of sql.matchAll(/DROP TABLE IF EXISTS (\w+)/g)) {
        dropped.add(match[1]);
      }
    }

    const inSnapshot = new Set(
      (await schemaLines()).flatMap((line) => {
        const match = /^CREATE TABLE IF NOT EXISTS (\w+)/.exec(line);
        return match ? [match[1]] : [];
      }),
    );

    const absent = [...createdByMigration]
      .filter(([table]) => !inSnapshot.has(table) && !dropped.has(table))
      .map(([table, file]) => `${table} (added by ${file})`);

    expect(absent, "a rebuild from this file would come up without these").toEqual([]);
  });

  it("defines the functions its own policies depend on", async () => {
    // Branch isolation is enforced by row-level-security policies that call
    // these. Without them a rebuilt database has the branch columns but no
    // wall, which fails open — every branch reading every other branch's rows.
    const source = await readFile("docs/schema.sql", "utf8");

    for (const name of [
      "krishoe_effective_branch_id",
      "krishoe_can_access_branch",
      "krishoe_admin_branch_context_enabled",
      "krishoe_admin_branch_bypass_enabled",
    ]) {
      expect(source, `${name}() must be defined in the schema file`).toContain(
        `CREATE OR REPLACE FUNCTION ${name}`,
      );
    }
  });
});
