import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { evenSplit, isSingleShoeSize, sizeWiseRows } from "@/lib/size-wise-stock";

/**
 * Finished pairs go into stock one size at a time.
 *
 * lose hill panja was made in 36–41 and posted as one 60-pair pile. The counter
 * bill showed its 36–40 as "not counted" and had no 41 at all, because a pile
 * cannot say what is in it and the catalog listed only 36–40. Posted as one row
 * per size, the bill already knows how to show "41 · 6 pairs".
 */
describe("the split", () => {
  it("knows a size from a run", () => {
    expect(isSingleShoeSize("41")).toBe(true);
    expect(isSingleShoeSize(" 9 ")).toBe(true);
    for (const notOne of ["36-41", "36/41", "Mixed", "", "41.5", "101"]) {
      expect(isSingleShoeSize(notOne), notOne).toBe(false);
    }
  });

  it("gives one row per size, smallest first, when the sizes add up", () => {
    expect(sizeWiseRows({ "41": 6, "36": 10, "40": 0 }, 16)).toEqual([
      ["36", 10],
      ["41", 6],
    ]);
  });

  it("refuses a split it cannot post as rows", () => {
    expect(sizeWiseRows({ "36": 10, "41": 6 }, 60), "does not add up").toBeNull();
    expect(sizeWiseRows({ "36-41": 60 }, 60), "a run, not a size").toBeNull();
    expect(sizeWiseRows({ "36": 2.5, "37": 2.5 }, 5), "half pairs").toBeNull();
    expect(sizeWiseRows({ "36": -1, "37": 6 }, 5), "negative").toBeNull();
    expect(sizeWiseRows({}, 0), "nothing").toBeNull();
    expect(sizeWiseRows(null, 10), "none sent").toBeNull();
  });

  it("prefills an even split only when it comes out whole", () => {
    const sizes = ["36", "37", "38", "39", "40", "41"];
    expect(evenSplit(sizes, 60)).toEqual({ "36": 10, "37": 10, "38": 10, "39": 10, "40": 10, "41": 10 });
    expect(evenSplit(sizes, 58), "a guess would be posted as a count").toBeNull();
    expect(evenSplit([], 60)).toBeNull();
  });
});

describe("where it is used", () => {
  it("the factory's Post to stock counts a run by size and sends the split", async () => {
    const screen = await readFile("app/admin/factory/add-work/ReadyToPost.tsx", "utf8");
    expect(screen).toContain("runSizes(item)");
    expect(screen).toContain("size_breakdown: sizeBreakdown");
    expect(screen).toContain("कुन साइजको कति जोडी");
    // The owner can still post an uncounted pile, as before.
    expect(screen).toContain("साइज नगनी जम्मा मात्र चढाउने");
  });

  it("the route posts one row per size in one transaction, and refuses a bad split", async () => {
    const route = await readFile("app/api/factory/ready/route.ts", "utf8");
    expect(route).toContain("sizeWiseRows(body.size_breakdown, pairs)");
    expect(route).toMatch(/if \(hasSplit && !split\)[\s\S]*?status: 400/);
    const helper = route.slice(route.indexOf("async function postSizeWise"));
    expect(helper).toContain("transactionPostgres(");
    expect(helper).toContain("sizeRun: size");
    // A double press replays rather than posting twice.
    expect(helper).toContain('"23505"');
  });

  it("Packing/QC posts good sizes as rows, and a reversal takes back every size", async () => {
    const lib = await readFile("lib/production-accounting.ts", "utf8");
    const approve = lib.slice(lib.indexOf("export async function approvePackingQcAndPostStock"));
    expect(approve.slice(0, 4000)).toContain("sizeWiseRows(normalizeSizeBreakdown(input.sizeBreakdown), input.totalPairs)");
    const reverse = lib.slice(lib.indexOf("export async function reversePackingQcAndStock"));
    expect(reverse).toContain("note LIKE $2 || ' · %'");
    // Checked in full before anything is taken back.
    expect(reverse.indexOf("plan.push")).toBeLessThan(reverse.indexOf("UPDATE finished_stock"));
  });

  it("leaves the counter bill as it is: it already counts sizes", async () => {
    const rules = await readFile("app/admin/pos/_components/pos-bill-rules.ts", "utf8");
    expect(rules).toContain("...Object.keys(counted)");
  });
});
