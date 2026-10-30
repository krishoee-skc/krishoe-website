import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCostSources, buildDesignCosting, buildFinishedStockValuation } from "@/lib/costing";
import { productOriginMigrations } from "@/lib/product-origins";
import type { FinishedStock } from "@/lib/operations";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * Made and bought costs (owner, 2026-10-30, the cost namuna, "garau 1 2 3 4
 * sabai"). Only shoes made with Upper and bottom wages are the factory's; the
 * rest are bought. So: the "no material" warning names factory shoes only, a
 * bought shoe with no purchase bill can say what it was bought at in its form
 * (without adding pairs), that cost comes after a bill and before the
 * counter's, and the form says where each shoe's cost comes from.
 */
const stock = (design: string, stockPairs: number): FinishedStock => ({
  id: design,
  design,
  channel: "Retail",
  sizeRun: "Mixed",
  stockPairs,
  soldPairs: 0,
  returnedPairs: 0,
});

describe("what a pair costs, made or bought", () => {
  it("puts a cost typed in the form ahead of the counter's and of factory rates", () => {
    const rows = buildDesignCosting(
      [],
      new Map([
        ["kitto 770", { design: "kitto 770", soldPairs: 1, returnedPairs: 0, netRevenue: 850 }],
        ["fom flat", { design: "Fom flat", soldPairs: 1, returnedPairs: 0, netRevenue: 150 }],
      ]) as never,
      [],
      new Map([["kitto 770", 40], ["fom flat", 50]]),
      0,
      13,
      new Map(),
      new Map([["kitto 770", 770]]),
      new Map([["kitto 770", 700]]),
    );
    const byName = Object.fromEntries(rows.map((row) => [row.design, row.unitCostPerPair]));
    expect(byName["kitto 770"]).toBe(700);
    expect(byName["Fom flat"]).toBe(63);
  });

  it("names only factory shoes as missing material", () => {
    const rows = buildFinishedStockValuation(
      [stock("Fom flat", 60), stock("kitto 770", 200), stock("putali patta flat", 5)],
      [],
      [],
      new Map([["fom flat", 63], ["kitto 770", 770], ["putali patta flat", 190]]),
      new Map(),
      new Set(["kitto 770", "putali patta flat"]),
    );
    const labourOnly = rows.filter((row) => row.labourOnly).map((row) => row.design);
    expect(labourOnly).toEqual(["Fom flat"]);
    // The costs themselves are untouched; only the warning changed.
    expect(rows.find((row) => row.design === "kitto 770")?.unitCostPerPair).toBe(770);
  });

  it("says where each cost comes from, in the order costing takes it", () => {
    const sources = buildCostSources(
      [
        { design: "close shoe chinies# 233", batchCount: 0, purchasedPairs: 55, unitCostPerPair: 525 } as never,
      ],
      {
        labour: new Map([["fom flat", 50]]),
        material: new Map(),
        counter: new Map([["kitto 770", 770], ["kitto#825", 775]]),
        chosen: new Map([["kitto#825", 760], ["bachhi rubber#340", 350]]),
        overhead: 13,
      },
    );
    expect(sources["close shoe chinies# 233"]).toMatchObject({ source: "purchase", perPair: 525 });
    expect(sources["kitto#825"]).toMatchObject({ source: "typed", perPair: 760 });
    expect(sources["bachhi rubber#340"]).toMatchObject({ source: "typed", perPair: 350 });
    expect(sources["kitto 770"]).toMatchObject({ source: "counter", perPair: 770 });
    expect(sources["fom flat"]).toEqual({ source: "rates", perPair: 63, labourAndOverhead: 63, material: 0 });
  });

  it("adds one column, the same in the app, the migration file and the schema, behind the same Settings OK", () => {
    const migration = productOriginMigrations[1];
    expect(migration).toMatchObject({ table: "product_origins", column: "cost_per_pair" });
    expect(migration.sql.replace(/\r\n/g, "\n")).toBe(read("scripts/migrations/20261030_product_origin_cost.sql"));
    expect(migration.sql).toContain("ADD COLUMN IF NOT EXISTS cost_per_pair");
    expect(read("docs/schema.sql")).toContain("cost_per_pair numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_per_pair >= 0)");
    // Choosing made or bought keeps working before the OK: two readiness checks.
    const lib = read("lib/product-origins.ts");
    expect(lib).toContain("export async function productOriginsReady()");
    expect(lib).toContain("export async function productOriginCostReady()");
  });

  it("shows the box only for a shoe that is not made and has no bill, and never adds pairs", () => {
    const page = read("app/admin/products/page.tsx");
    expect(page).toContain("canType: canKeep && !made && !fromBill");
    const save = read("app/admin/actions.ts");
    expect(save).toContain("await setChosenCost(product.id, boughtCost");
    expect(read("lib/product-origins.ts")).not.toMatch(/stock_movements|finished_stock/);
  });

  it("points the warning at Items and rates", () => {
    const banner = read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(banner).toContain("Factory shoes with no material");
    expect(banner).toContain('href="/admin/factory/items"');
  });
});
