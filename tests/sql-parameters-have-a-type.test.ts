import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A statement Postgres refuses to plan.
 *
 * `concat_ws(' · ', nullif(notes, ''), $2)` looks fine and reads fine, and
 * Postgres rejects it outright: "could not determine data type of parameter
 * $2". The function takes `any`, so there is nothing to infer the parameter's
 * type from, and the statement fails before it touches a row.
 *
 * This shipped. The reverse button added to the piece ledger would have failed
 * the first time it was pressed, and the tests all passed, because they read
 * the source and never ran the SQL. It was caught by executing the statement
 * against the live schema inside a rollback while building the edit that uses
 * the same pattern.
 *
 * Every parameter inside concat_ws now carries an explicit cast.
 */
const FILES = [
  "lib/factory-mutations.ts",
  "lib/production-accounting.ts",
  "lib/factory-board-data.ts",
];

describe("a parameter Postgres can type", () => {
  it("is cast wherever concat_ws would have to guess", async () => {
    const sources = await Promise.all(FILES.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    sources.forEach((source, index) => {
      // A bare $n inside concat_ws — no ::type after it.
      for (const match of source.matchAll(/concat_ws\([^)]*\$\d+(?!::)[^)]*\)/g)) {
        offenders.push(`${FILES[index]}: ${match[0].replace(/\s+/g, " ").trim()}`);
      }
    });

    expect(
      offenders.join("\n"),
      "concat_ws cannot infer a parameter's type — add ::text, or Postgres refuses the statement",
    ).toBe("");
  });

  it("keeps the note the reversal and the edit leave on an entry", async () => {
    const mutations = await readFile("lib/factory-mutations.ts", "utf8");
    const accounting = await readFile("lib/production-accounting.ts", "utf8");

    // Both write their reason onto the row rather than replacing what is there,
    // so an entry corrected twice keeps both notes.
    expect(accounting).toContain("concat_ws(' · ', nullif(notes, ''), $2::text)");
    expect(mutations).toContain("concat_ws(' · ', nullif(notes, ''), $5::text)");
    expect(mutations).toContain("concat_ws(' · ', nullif(note, ''), $11::text)");
  });
});
