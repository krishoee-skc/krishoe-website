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

  it("every one of them is in both scripts that run them", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const live: string = pkg.scripts["test:live"] ?? "";
    const ci: string = pkg.scripts["test:live:ci"] ?? "";
    const missing: string[] = [];

    expect(live, "npm run test:live is missing").not.toBe("");
    expect(ci, "npm run test:live:ci is missing").not.toBe("");

    for (const file of await filesThatSkipWithoutADatabase()) {
      // Compare on the basename: the scripts write forward slashes, and this
      // repo is worked on from Windows.
      const name = path.basename(file);
      if (!live.includes(name)) missing.push(`${name} (test:live)`);
      if (!ci.includes(name)) missing.push(`${name} (test:live:ci)`);
    }

    expect(
      missing.join(", "),
      "a live test exists that one of the two scripts does not run",
    ).toBe("");
  });

  it("runs itself every week, so nobody has to remember", async () => {
    const workflow = await readFile(".github/workflows/live-stock-tests.yml", "utf8");

    // The owner said plainly that they will forget. A test that depends on
    // being remembered is a test that eventually stops running.
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("npm run test:live:ci");
    // And can be started by hand the moment stock code changes.
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("says so instead of going green when the database secret is missing", async () => {
    const workflow = await readFile(".github/workflows/live-stock-tests.yml", "utf8");

    // Without DATABASE_URL the files skip themselves, and a run that checked
    // nothing would otherwise report success — the worst of both.
    expect(workflow).toContain("::warning::");
  });

  it("runs the files one at a time, because they share one database", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));

    // Run in parallel these failed about one time in three with "duplicate key
    // value violates unique constraint products_name_unique_idx". The catalog
    // sync reads EVERY design's finished stock, so one file's sync would see
    // another file's freshly seeded design and both would insert the same
    // product. Serial, they passed five runs out of five.
    expect(pkg.scripts["test:live"]).toContain("--no-file-parallelism");
    expect(pkg.scripts["test:live:ci"]).toContain("--no-file-parallelism");
  });

  it("has every live test remove the product its stock created", async () => {
    const files = await filesThatSkipWithoutADatabase();
    const missing: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      // Seeding finished_stock makes the catalog sync create a products row.
      // Two of these tests were not deleting it, and the shop's live catalogue
      // held "ZZ probe design" with 54 pairs and "ZZ damage probe design" with
      // 20 — unbacked stock of exactly the kind just cleaned out of it.
      if (!source.includes("DELETE FROM products")) missing.push(path.basename(file));
    }

    expect(
      missing.join(", "),
      "a live test seeds stock but never removes the product the catalog sync makes from it",
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
