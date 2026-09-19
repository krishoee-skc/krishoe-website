import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Everything downstream still counts the same pairs.
 *
 * The ready screen, the wages board, the worker totals and the upper guard all
 * read pairs_count. Adding a per-size breakdown beside it creates exactly one
 * way for the factory's numbers to split in two: a row whose boxes say seven
 * while its total says sixty would be paid at sixty, counted at sixty on the
 * board, and posted to stock at sixty, with the breakdown quietly describing a
 * different entry.
 *
 * The save is what prevents it — pairs_count is taken FROM the boxes rather
 * than stored next to them — so this fixes that rule in place. It is not a
 * restatement of the save's own test: that one says the counts are written,
 * this one says nothing downstream was given a second, competing source for
 * the same number.
 */
const MUTATIONS = "lib/factory-mutations.ts";
const READY = "app/api/factory/ready/route.ts";

describe("one number for one quantity", () => {
  it("takes the total from the boxes at the save", async () => {
    const code = await readFile(MUTATIONS, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The single rule everything else depends on. Asserted as the assignment,
    // because a version that computes the sum and still stores input.pairsCount
    // leaves every word in this file intact.
    expect(clean, "the counted pairs must win").toMatch(
      /const\s+pairsCount\s*=\s*hasCounts\s*\?\s*countedPairs\s*:\s*input\.pairsCount/,
    );
  });

  it("writes that same number as the row's pairs_count", async () => {
    const code = await readFile(MUTATIONS, "utf8");
    const insert = code.slice(code.indexOf("INSERT INTO factory_daily_work"));

    // Not input.pairsCount. The wage, the board and the stock posting all read
    // this column, and it has to be the number the boxes add up to.
    const params = insert.slice(insert.indexOf("["), insert.indexOf("]") + 1);
    expect(params, "the reconciled count is stored").toMatch(/\bpairsCount,/);
    expect(params, "not the typed one").not.toMatch(/input\.pairsCount/);
  });

  it("leaves the ready screen reading pairs_count", async () => {
    const code = await readFile(READY, "utf8");

    // It should NOT learn about size_counts. Two places deciding how many pairs
    // a row is worth is the drift this whole arc removes; because the save
    // reconciles them, the existing sum is already the right answer.
    expect(code, "the ready screen still sums the column").toMatch(/work\.pairs_count/);
    expect(code, "and must not grow a second source").not.toMatch(/size_counts/);
  });

  it("keeps rejects coming off the reconciled total", async () => {
    const code = await readFile(MUTATIONS, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Rejects are capped at the pairs actually made. Capping them against the
    // typed total instead would let a seven-pair entry record sixty rejects.
    expect(clean).toMatch(/Math\.min\(pairsCount,/);
  });
});
