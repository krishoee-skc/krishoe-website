import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A pair that failed QC is not a pair the shop can sell.
 *
 * The work entry has asked for rejected pairs since it was written — "खराब जोडी
 * (QC)", with a note saying to leave it blank when all sixty are good. Nothing
 * downstream read it. The ready-to-post count summed pairs_count per stage and
 * took the smallest, so sixty uppers with five spoiled and sixty bottoms still
 * read as sixty finished pairs.
 *
 * While the owner walked to the godown and counted, that was harmless — the
 * count on the shelf was the number that got typed. It stopped being harmless
 * the moment the screen pre-filled the number and one press posted it: five
 * pairs that exist on no shelf would go into stock, and the shop would sell
 * them.
 *
 * Rejected pairs are subtracted at the stage that rejected them, not from the
 * total. Five spoiled at Upper leaves fifty-five uppers; if the bottoms are all
 * sixty, fifty-five pairs are finished — the smallest stage still wins, which
 * is the rule that was already right.
 */
const ROUTE = "app/api/factory/ready/route.ts";

describe("rejected pairs are taken off", () => {
  it("reads them from the work", async () => {
    const route = await readFile(ROUTE, "utf8");

    // The column has held real numbers since the form shipped; nothing asked
    // for it.
    expect(route).toMatch(/reject_pairs/);
  });

  it("subtracts them from the stage that rejected them", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Not from the finished total: five spoiled at Upper is five fewer uppers,
    // and whether that costs a finished pair depends on the bottoms, which the
    // existing smallest-stage rule already decides.
    expect(code).toMatch(/SUM\(\s*work\.pairs_count\s*-\s*COALESCE\(work\.reject_pairs,\s*0\)\s*\)/i);
  });

  it("never lets a stage go below zero", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // More rejects than pairs is a typing slip, not negative production. A
    // negative stage would raise the smallest-stage minimum and overstate what
    // is finished.
    expect(code).toMatch(/GREATEST\(/i);
  });
});

describe("the arithmetic that was already right", () => {
  it("still takes the smallest stage", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Fifty-five uppers and sixty bottoms are fifty-five pairs, not a hundred
    // and fifteen.
    expect(code).toMatch(/Math\.min/);
  });

  it("still counts a missing stage as zero", async () => {
    const route = await readFile(ROUTE, "utf8");
    const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code).toMatch(/\?\?\s*0/);
  });
});
