import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The eight tests that never ran.
 *
 * `npm run test:run` finishes with "5 skipped, 8 skipped", and the owner asked
 * what those were. They are the five files that move real pairs through a real
 * Postgres — a challan leaving the factory, a Damage Out, a POS return going
 * back to stock, size routing, and a shoe's whole life from made to sold. Each
 * one begins `describe.skipIf(!process.env.DATABASE_URL)`, and the normal test
 * run has no DATABASE_URL on purpose, so that a routine gate can never reach
 * the shop's own data.
 *
 * That part is right. What was wrong is that nothing ran them either: the only
 * way in was a long command typed from memory, so the eight tests that guard
 * the shop's stock arithmetic — the ones that caught a challan inserting its
 * lines before the challan they belong to, and a join turning 54 pairs into 108
 * — sat unrun. A test nobody runs is a comment.
 *
 * So `npm run test:live` runs them, and this test keeps that script honest: a
 * new live file that is not listed in it would otherwise be skipped in the
 * normal run and forgotten in the live one, which is worse than not writing it.
 */
async function testFiles(): Promise<string[]> {
  const entries = await readdir("tests", { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => path.join("tests", entry.name));
}

/**
 * Every test file that takes itself out of a run with no database.
 *
 * Matched on the actual call — `describe.skipIf(!process.env.DATABASE_URL)` at
 * the start of a line — not on the bare string. This file names that string
 * several times while describing it, and a looser match counted this file as
 * one of them.
 */
async function filesThatSkipWithoutADatabase() {
  const files = await testFiles();
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const call = /^describe\.skipIf\(!process\.env\.DATABASE_URL\)/m;
  return files.filter((_, index) => call.test(sources[index]));
}

describe("the tests that need a real database", () => {
  it("are exactly the five that move real pairs", async () => {
    const found = (await filesThatSkipWithoutADatabase()).map((file) => path.basename(file)).sort();

    expect(found).toEqual([
      "damage-out-live.test.ts",
      "e2e-lifecycle-live.test.ts",
      "pos-return-to-stock-live.test.ts",
      "size-routing-live.test.ts",
      "stock-transfer-challan.test.ts",
    ]);
  });

  it("every one of them is in the script that runs them", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const script: string = pkg.scripts["test:live"] ?? "";
    const missing: string[] = [];

    expect(script, "npm run test:live is missing").not.toBe("");

    for (const file of await filesThatSkipWithoutADatabase()) {
      // Compare on the basename: the script writes forward slashes, and this
      // repo is worked on from Windows.
      if (!script.includes(path.basename(file))) missing.push(path.basename(file));
    }

    expect(
      missing.join(", "),
      "a live test exists that nothing runs — add it to the test:live script",
    ).toBe("");
  });

  it("hands the run a database, since that is the whole point", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));

    // Without --env-file the files skip themselves again and the script would
    // report a green run of nothing.
    expect(pkg.scripts["test:live"]).toContain("--env-file=.env.local");
  });

  it("stays out of the ordinary gate, which must never touch the shop", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));

    // npm run check is what runs before a push; it must keep skipping these.
    expect(pkg.scripts.check).not.toContain("test:live");
  });
});
