import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { normaliseSizeCounts, sizeCountsTotal } from "@/lib/shoe-sizes";

/**
 * The per-size counts have to reach the database, and agree with the total.
 *
 * factory_daily_work now has a size_counts column. A column nothing writes to
 * is worse than no column: the screen would show the boxes, a person would fill
 * them in, and the pairs would be recorded as a total exactly as before — with
 * the breakdown silently dropped on the way to the server.
 *
 * The number that must not drift is pairs_count. The wage is paid on it, the
 * ready screen counts it, and the upper guard matches on it. If the boxes say
 * seven and pairs_count says sixty, one of them is a lie and the ledger cannot
 * say which.
 *
 * So the total is taken FROM the boxes when they are filled, rather than stored
 * beside a separately typed number and hoped to match.
 */
const MUTATIONS = "lib/factory-mutations.ts";
const ROUTE = "app/api/factory/work/route.ts";

describe("what the save writes", () => {
  it("stores the counts on the factory row", async () => {
    const code = await readFile(MUTATIONS, "utf8");

    // Asserted as the column inside the insert, not as the word anywhere in
    // the file: a comment mentioning size_counts passes a name check while the
    // insert writes nothing.
    const insert = code.slice(code.indexOf("INSERT INTO factory_daily_work"));
    expect(insert.length, "the insert moved").toBeGreaterThan(0);
    expect(insert.slice(0, 700), "the column must be written").toMatch(/size_counts/);
  });

  it("carries the counts through the API route", async () => {
    const code = await readFile(ROUTE, "utf8");

    // The route builds the input the mutation is called with. A field it does
    // not copy across never leaves the browser.
    //
    // Asserted as the field being set on that input, with comments stripped:
    // the words appear in a comment beside it, so a looser check passes on a
    // route that reads the body and quietly drops it.
    const body = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(body, "the counts must be passed to createFactoryWork").toMatch(
      /sizeCounts:\s*[\s\S]{0,200}body\.size_counts/,
    );
  });

  it("writes the real breakdown to production_work_entries too", async () => {
    const code = await readFile(MUTATIONS, "utf8");

    // This table has had a size_breakdown column all along, and the sync has
    // been writing {"36/41": 60} into it — the whole run as one key, which is
    // the same non-answer in JSON. With real counts on hand it must store
    // those instead.
    const syncAt = code.indexOf("INSERT INTO production_work_entries");
    expect(syncAt, "the sync insert moved").toBeGreaterThan(0);

    // The breakdown is chosen just above the insert and passed into it. Both
    // halves are asserted: choosing the real counts and then passing the old
    // single-key object would read correctly and store the same non-answer.
    const around = code.slice(syncAt - 600, syncAt + 1400);
    expect(around, "the real counts must be preferred").toMatch(
      /hasCounts\s*\?\s*sizeCounts\s*:/,
    );
    expect(around, "and must be what is written").toMatch(
      /JSON\.stringify\(breakdown\)/,
    );
  });
});

/**
 * The arithmetic the save depends on, checked here rather than trusted.
 *
 * These are the rules the insert relies on: filled boxes decide the total,
 * empty boxes leave the typed total alone, and nothing is ever stored that
 * disagrees with pairs_count.
 */
describe("the total and the boxes cannot disagree", () => {
  it("takes the total from the boxes when they are filled", () => {
    // The owner's case: 36–41 with 38 made twice is seven pairs. Seven is what
    // the wage is paid on, not the sixty the box was pre-filled with.
    const counts = normaliseSizeCounts({ "36": 1, "37": 1, "38": 2, "39": 1, "40": 1, "41": 1 });

    expect(sizeCountsTotal(counts)).toBe(7);
  });

  it("an even run still adds to its total", () => {
    const counts = normaliseSizeCounts({
      "36": 10, "37": 10, "38": 10, "39": 10, "40": 10, "41": 10,
    });

    expect(sizeCountsTotal(counts)).toBe(60);
  });

  it("empty boxes mean nothing was recorded, not zero pairs", () => {
    // An untouched breakdown must leave the typed total alone. Storing {} and
    // a total of 0 would erase the entry.
    const counts = normaliseSizeCounts({ "36": "", "37": "", "38": "" });

    expect(counts).toEqual({});
    expect(sizeCountsTotal(counts)).toBe(0);
  });
});
