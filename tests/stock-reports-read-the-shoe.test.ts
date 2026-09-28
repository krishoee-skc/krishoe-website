import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { groupFinishedStock } from "@/lib/operations";

/**
 * The Operations reports read one shoe, not one size row.
 *
 * Fom flat went into stock size by size — 25 to 30, ten each — and the
 * Operations page then showed "Variance -50" on every size (each row's 10
 * against all 60 pairs of movement), "Low stock" four times for a shoe with
 * sixty pairs, the same name filling the slow-moving list, and 0 "into stock
 * today" because that card only counted Packing/QC. The stock itself was
 * right; the reports read it wrongly.
 */
const row = (id: string, sizeRun: string, stockPairs: number) => ({
  id,
  design: "Fom flat",
  channel: "Factory" as const,
  sizeRun,
  stockPairs,
  soldPairs: 0,
  returnedPairs: 0,
});

describe("one shoe, however many size rows", () => {
  it("adds the rows up, sizes in order", () => {
    const [shoe, ...others] = groupFinishedStock([
      row("r29", "29", 10),
      row("r25", "25", 10),
      row("r30", "30", 10),
      row("r26", "26", 10),
      row("r27", "27", 10),
      row("r28", "28", 10),
    ]);
    expect(others).toHaveLength(0);
    expect(shoe.stockPairs).toBe(60);
    expect(shoe.sizes.map((size) => size.size)).toEqual(["25", "26", "27", "28", "29", "30"]);
    expect(shoe.sizeRun).toBe("25-30");
    expect(shoe.ids).toHaveLength(6);
  });

  it("keeps a single row as it was", () => {
    const [shoe] = groupFinishedStock([row("a", "36, 37, 38, 39, 40, 41", 53)]);
    expect(shoe.sizeRun).toBe("36, 37, 38, 39, 40, 41");
    expect(shoe.stockPairs).toBe(53);
  });

  it("keeps two shoes, and two channels of one shoe, apart", () => {
    const shoes = groupFinishedStock([
      row("a", "25", 10),
      { ...row("b", "25", 10), channel: "Wholesale" as const },
      { ...row("c", "Mixed", 5), design: "bantu hill" },
    ]);
    expect(shoes).toHaveLength(3);
  });
});

describe("where the reports use it", () => {
  it("checks the ledger, stock watch and fast/slow lists per shoe", async () => {
    const lib = await readFile("lib/operations.ts", "utf8");
    expect(lib).toContain("const stockByShoe = groupFinishedStock(data.finishedStock);");
    expect(lib).toContain("const stockHealthRows = stockByShoe");
    expect(lib).toContain("const stockLedgerRows = stockByShoe");
    expect(lib).toContain("const slowMovingStock = [...stockByShoe]");
  });

  it("draws the finished stock table one line per shoe, sizes inside", async () => {
    const records = await readFile("app/admin/operations/_components/OperationsRecords.tsx", "utf8");
    expect(records).toContain("snapshot.finishedStockByShoe.map((shoe) =>");
    expect(records).toContain("साइज अनुसार सच्याउने");
    expect(records).toContain("<FinishedStockEditForm stock={stock} />");
  });

  it("counts every pair the factory put into stock today", async () => {
    const lib = await readFile("lib/production-accounting.ts", "utf8");
    const card = lib.slice(lib.indexOf("-- Every pair the factory put into stock today"), lib.indexOf("AS today_stock_pairs"));
    expect(card).toContain("FROM stock_movements");
    expect(card).toContain("type = 'Production In'");
    expect(card).not.toContain("production_qc_postings");
    const page = await readFile("app/admin/operations/page.tsx", "utf8");
    expect(page).toContain('ne="कारखानाबाट"');
  });
});
