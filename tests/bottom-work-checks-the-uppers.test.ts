import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The upper-first rule, actually enforced.
 *
 * lib/stage-order.ts knows the rule; until this, nothing asked it. A fibre or
 * bottom entry for sixty pairs went through whether sixty uppers existed or
 * none did, and once stock posts itself from these entries that is pairs in the
 * godown that were never made.
 *
 * This is the one guard in the set that can refuse a worker's work, so it is
 * held to a higher bar than the rest:
 *
 *  - it counts uppers for the same item, colour and size run — not the item
 *    alone, or a black 36/41 upper would pay for a cherry 36/42 bottom;
 *  - it compares them through the two keys built for exactly this, so "Black"
 *    matches "black" and "36/41" matches "36, 37, 38, 39, 40, 41";
 *  - it reads inside the same transaction that writes, or two entries saved
 *    together could each see uppers the other was about to spend;
 *  - and it says how many are short, because a worker standing at the screen
 *    needs to know whether to fix the number or fetch the supervisor.
 */
const MUTATIONS = "lib/factory-mutations.ts";

describe("the rule is asked before a bottom entry is saved", () => {
  it("calls the rule it was given", async () => {
    const source = await readFile(MUTATIONS, "utf8");

    expect(source).toMatch(/from "@\/lib\/stage-order"/);
    expect(source).toContain("stageNeedingUpperFirst");
    expect(source).toContain("upperShortfall");
  });

  it("only looks when the stage needs an upper", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Upper itself must never be held back, and the query must not run for it
    // either — an extra read on every entry the factory makes.
    expect(code).toMatch(/if\s*\(\s*stageNeedingUpperFirst\(/);
  });

  it("counts uppers of the same colour and size run, not just the same item", async () => {
    const source = await readFile(MUTATIONS, "utf8");

    const guard = source.slice(
      source.indexOf("stageNeedingUpperFirst(stage)"),
      source.indexOf("stageNeedingUpperFirst(stage)") + 1600,
    );
    expect(guard.length, "the guard moved").toBeGreaterThan(0);

    // The whole point of A1 and A2, and asserted as the comparison rather than
    // the mere presence of the word: removing either filter leaves the import
    // in place, so a name check would pass on a guard that no longer filters.
    // Matching on item alone would let a black 36/41 upper pay for a cherry
    // 36/42 bottom.
    expect(guard, "colour must be compared").toMatch(
      /colourKey\(row\.color\)\s*!==\s*\w+/,
    );
    expect(guard, "size run must be compared").toMatch(
      /sizeRunKey\(row\.size\)\s*!==\s*\w+/,
    );
  });

  it("reads inside the transaction that writes", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const guard = source.slice(
      source.indexOf("stageNeedingUpperFirst("),
      source.indexOf("stageNeedingUpperFirst(") + 1600,
    );

    expect(guard.length, "the guard moved").toBeGreaterThan(0);
    // db.query, not queryPostgres: two entries saved at the same moment must
    // not each see uppers the other is about to spend.
    expect(guard).toContain("db.query");
  });
});

describe("it warns rather than refuses", () => {
  it("does not block the entry", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const guard = source.slice(
      source.indexOf("stageNeedingUpperFirst(stage)"),
      source.indexOf("stageNeedingUpperFirst(stage)") + 2200,
    );

    expect(guard.length, "the guard moved").toBeGreaterThan(0);
    // The owner's call, and a considered one: made a refusal on the day it
    // shipped, it would have blocked two of the factory's own entries — both
    // typing slips, not real work. A worker standing at the screen is not the
    // right person to discover a rule the shop has not lived with yet.
    expect(guard, "no refusal in the guard").not.toContain("throw new FactoryMutationError");
    expect(guard).toContain("upperWarning");
  });

  it("says how many pairs are over, and what to check", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const guard = source.slice(
      source.indexOf("stageNeedingUpperFirst(stage)"),
      source.indexOf("stageNeedingUpperFirst(stage)") + 2200,
    );

    // A bare "check this" leaves the worker guessing. The count, and the two
    // fields most likely to be wrong, tell them what to look at.
    expect(guard).toMatch(/\$\{shortfall\}/);
    expect(guard).toMatch(/\$\{uppersMade\}/);
    expect(guard).toMatch(/colour[\s\S]{0,40}size|size[\s\S]{0,40}colour/i);
  });

  it("carries the warning back to the screen", async () => {
    const source = await readFile(MUTATIONS, "utf8");

    // Recorded on the response, or the guard would count quietly and tell
    // nobody — which is worse than not checking at all.
    expect(source).toContain("upper_warning");
    expect(source).toMatch(/workResponse\([^)]*upperWarning\)/);
  });

  it("stays empty when the run fits", async () => {
    const source = await readFile(MUTATIONS, "utf8");
    const guard = source.slice(
      source.indexOf("stageNeedingUpperFirst(stage)"),
      source.indexOf("stageNeedingUpperFirst(stage)") + 2200,
    );

    // Most entries are fine. A warning that shows on all of them is ignored on
    // the one that matters.
    expect(guard).toMatch(/shortfall > 0[\s\S]{0,400}?:\s*""/);
  });
});
