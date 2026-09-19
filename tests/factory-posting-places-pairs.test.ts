import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Pairs posted from the factory land at the factory.
 *
 * The Stock screen keeps two answers apart: finished_stock says how many pairs
 * exist, stock_locations says where they are. Posting from the factory wrote
 * only the first, so three hundred pairs sat under "in stock without a place"
 * and the FACTORY tile read zero while the godown held five runs of sixty.
 *
 * Nothing was lost — selling draws on the total — but the owner could not see
 * where their own stock was, and the only way to fix it was to walk over and
 * count pairs that had never moved.
 *
 * A purchase already places what it buys, and a challan places what it sends.
 * Production is the one inflow that placed nothing, and the answer was never in
 * doubt: pairs made at the factory are at the factory until something moves
 * them.
 *
 * Placed under the same size run they were posted under. The Stock screen joins
 * the two tables on design AND size run, so a run of 36/41 placed as "Mixed"
 * lands in a row nothing matches — which is the same invisible pairs again,
 * one table further along.
 */
const ROUTE = "app/api/factory/ready/route.ts";

describe("posting finished pairs", () => {
  it("records where the pairs are, not only how many", async () => {
    const code = await readFile(ROUTE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the call, with comments stripped: the words "stock_locations"
    // already appear in this file's prose, so a name check passes on the bug.
    expect(clean, "the pairs must be placed").toMatch(/placePairs\(/);
  });

  it("places them at the factory, where they were made", async () => {
    const code = await readFile(ROUTE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const call = clean.slice(clean.indexOf("placePairs("));
    expect(call.length, "the placePairs call moved").toBeGreaterThan(0);
    expect(call.slice(0, 200), "the place is the factory").toMatch(/"Factory"/);
  });

  it("uses the same size run the movement was posted under", async () => {
    const code = await readFile(ROUTE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The Stock screen joins on design AND size run. Placing a 36/41 run under
    // "Mixed" puts the pairs in a row the screen cannot match — invisible
    // again, one table further along.
    const call = clean.slice(clean.indexOf("placePairs("));
    expect(call.slice(0, 200), "the run must match the movement").toMatch(/\bsizeRun\b/);
  });

  it("places the same design the movement was written for", async () => {
    const code = await readFile(ROUTE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const call = clean.slice(clean.indexOf("placePairs("));
    expect(call.slice(0, 200), "the design must match").toMatch(/items\[0\]\.name/);
  });

  it("does not place anything on a replayed post", async () => {
    const code = await readFile(ROUTE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The replay path returns before the work is done. Placing there would add
    // the pairs to the factory a second time on a double tap — the exact
    // double-count the submission key exists to prevent, moved to the other
    // table.
    const replayAt = clean.indexOf("replayed: true");
    const placeAt = clean.indexOf("placePairs(");
    expect(replayAt, "the replay path moved").toBeGreaterThan(0);
    expect(placeAt, "the placePairs call moved").toBeGreaterThan(0);
    expect(placeAt, "placing must come after the replay guard returns").toBeGreaterThan(replayAt);
  });
});
