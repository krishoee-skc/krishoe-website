import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The factory's reads all live in one file now, shared by the API routes and
 * the server-rendered screens so a figure cannot mean two things. These are the
 * properties of that file that no unit test over pure functions would catch,
 * because they are about the SQL text itself.
 */
const READER = "lib/factory-board-data.ts";

describe("the factory's database reads", () => {
  it("numbers every placeholder it builds", async () => {
    const source = await readFile(READER, "utf8");

    // A placeholder built by interpolation is one keystroke from disaster:
    // `= ${params.length}` renders as "= 1", which Postgres reads as the
    // integer one rather than the first parameter — comparing worker_type to a
    // number, and matching nobody. The dollar has to be there.
    for (const match of source.matchAll(/\$\{params\.length\}/g)) {
      const before = source.slice(Math.max(0, (match.index ?? 0) - 2), match.index);
      expect(before, "a params.length placeholder without its $").toContain("$");
    }
  });

  it("passes user input as parameters, never pasted into the SQL", async () => {
    const source = await readFile(READER, "utf8");

    // Only the two shapes the reader is allowed to interpolate: a WHERE clause
    // it assembled itself, and a constant ceiling. Anything else interpolated
    // into a query string would be a place a value could arrive in the SQL.
    const interpolations = [...source.matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1].trim());
    const allowed = new Set([
      // The WHERE clause the reader assembled, and the pieces it is built from.
      "where",
      `conditions.join(" AND ")`,
      // A placeholder number, not a value: "$1", "$2".
      "params.length",
      // A constant defined in the file.
      "MAX_DAY_ENTRIES",
      // A fixed clause chosen by a boolean — no value reaches the SQL.
      `options.includeRetired ? "" : "WHERE items.status = 'active'"`,
    ]);

    for (const value of interpolations) {
      expect(allowed.has(value), `unexpected interpolation into SQL: \${${value}}`).toBe(true);
    }
  });

  it("keeps a ceiling on the one read that grows every day", async () => {
    const source = await readFile(READER, "utf8");

    // factory_daily_work gains rows for as long as the factory runs. Every
    // other read here is bounded by headcount or by an aggregate.
    expect(source).toContain("LIMIT ${MAX_DAY_ENTRIES}");
  });

  it("hides retired people and items unless the screen asks for them", async () => {
    const source = await readFile(READER, "utf8");

    expect(source).toContain(`conditions.push("workers.status = 'active'")`);
    expect(source).toContain(`options.includeRetired ? "" : "WHERE items.status = 'active'"`);
  });
});
