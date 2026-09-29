import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { marginTone, pairProfitRows } from "@/app/admin/operations/_components/ProfitPerPair";
import type { OperationsCostingSnapshot } from "@/app/admin/operations/_components/types";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The Operations page, 2026-09-29: "Made this week 420" for 180 pairs into
 * stock; three batch tiles at 0 beside 215 ready pairs; a profit built on
 * labour alone; Fom flat costed at Rs. 0; "Net −30" for a shoe bought thirty
 * and sold thirty; twelve empty sections; bills spread over eleven lines.
 */
describe("the week and the tiles", () => {
  it("shows pairs into stock as made this week, with the stages beside it", async () => {
    const page = await read("app/admin/operations/page.tsx");
    expect(page).toContain("const weekStockPairs = weekSummary.stockPostedPairs;");
    expect(page).toContain("यो हप्ता स्टकमा चढेको");
    expect(page).not.toContain("row.completedPairs, 0)");
  });

  it("shows ready stock instead of three batch zeros until batches are used", async () => {
    const overview = await read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(overview).toContain("{batchesUsed ? (");
    expect(overview).toContain('<T en="Ready stock" ne="तयार स्टक" />');
  });

  it("says when a cost is labour alone", async () => {
    const overview = await read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(overview).toContain("ज्याला मात्र, कच्चा पदार्थ छैन");
    const costing = await read("lib/costing.ts");
    expect(costing).toContain("finishedStockLabourOnlyDesigns");
  });
});

describe("costing", () => {
  it("costs a made shoe that never sold from its own rates, not Rs. 0", async () => {
    const costing = await read("lib/costing.ts");
    expect(costing).toContain("designCost?.unitCostPerPair || derivedUnitCostByKey.get(designKey(design)) || 0");
  });

  it("counts bought pairs in a shoe's net flow", async () => {
    const operations = await read("lib/operations.ts");
    const block = operations.slice(operations.indexOf('if (movement.type === "Purchase In") {'));
    expect(block.slice(0, 120)).toContain("group.netStockFlow += movement.pairs;");
  });
});

describe("profit on one pair", () => {
  const costing = {
    finishedStockValuation: [
      { design: "eva fab", stockPairs: 29, unitCostPerPair: 375, averageSalePrice: 388.6, labourOnly: false },
      { design: "lose hill", stockPairs: 30, unitCostPerPair: 153, averageSalePrice: 950, labourOnly: true },
      { design: "lose hill", stockPairs: 23, unitCostPerPair: 153, averageSalePrice: 950, labourOnly: true },
      { design: "Doctor", stockPairs: 0, unitCostPerPair: 575, averageSalePrice: 0, labourOnly: false },
    ],
  } as unknown as OperationsCostingSnapshot;

  it("gives one line per shoe in stock, thinnest first", () => {
    const rows = pairProfitRows(costing);
    expect(rows.map((row) => row.design)).toEqual(["eva fab", "lose hill"]);
    expect(rows[1].stockPairs).toBe(53);
    expect(Math.round(rows[0].profit ?? 0)).toBe(14);
  });

  it("marks almost no profit red, and a healthy one green", () => {
    const [evaFab, loseHill] = pairProfitRows(costing);
    expect(marginTone(evaFab)).toBe("bad");
    expect(marginTone(loseHill)).toBe("good");
  });
});

describe("the page's shape", () => {
  it("folds the parts nobody has used yet, and the fifteen downloads", async () => {
    const records = await read("app/admin/operations/_components/OperationsRecords.tsx");
    expect(records).toContain("const unused = parts.filter((part) => !part.used);");
    const overview = await read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(overview).toContain("CSV रिपोर्ट डाउनलोड");
  });

  it("lists stock movements one line per bill", async () => {
    const records = await read("app/admin/operations/_components/OperationsRecords.tsx");
    expect(records).toContain("/KR-(?:BILL|PUR)-[A-Za-z0-9-]+/");
    expect(records).toContain("const groups = groupMovements(snapshot.stockMovements);");
  });

  it("has nothing smaller than 12px", async () => {
    for (const file of [
      "app/admin/operations/_components/OperationsOverview.tsx",
      "app/admin/operations/_components/OperationsRecords.tsx",
    ]) {
      expect(await read(file), file).not.toMatch(/(?<=[\s"'`:])text-(xs|\[1[01]px\])(?=[\s"'`])/);
    }
  });
});
