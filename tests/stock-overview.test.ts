import { describe, expect, it } from "vitest";
import { buildStockOverview } from "@/lib/stock-overview";
import type { OperationsData } from "@/lib/operations";
import type { Product } from "@/lib/products";

function operationsFixture(): OperationsData {
  return {
    rawMaterials: [
      { id: "rm-1", name: "Rexin", unit: "meter", openingStock: 100, received: 25, used: 90, reorderLevel: 40 },
    ],
    materialConsumptions: [],
    workerTasks: [],
    productionBatches: [],
    finishedStock: [
      { id: "m", design: "Factory Sandal", channel: "Factory", sizeRun: "36-41", stockPairs: 20, soldPairs: 0, returnedPairs: 0 },
      { id: "p", design: "Resale Shoe", channel: "Retail", sizeRun: "Mixed", stockPairs: 12, soldPairs: 0, returnedPairs: 0 },
      { id: "x", design: "Shared Design", channel: "Retail", sizeRun: "Mixed", stockPairs: 9, soldPairs: 0, returnedPairs: 0 },
      { id: "o", design: "Opening Pair", channel: "Retail", sizeRun: "Mixed", stockPairs: 4, soldPairs: 0, returnedPairs: 0 },
    ],
    vehicleDispatches: [],
    vehicleDispatchItems: [],
    customerLedgers: [],
    ledgerTransactions: [],
    stockMovements: [
      { id: "1", createdAt: "2026-08-01T00:00:00.000Z", design: "Factory Sandal", channel: "Factory", sizeRun: "36-41", type: "Production In", pairs: 20, note: "" },
      { id: "2", createdAt: "2026-08-01T00:00:00.000Z", design: "Resale Shoe", channel: "Retail", sizeRun: "Mixed", type: "Purchase In", pairs: 12, note: "" },
      { id: "3", createdAt: "2026-08-01T00:00:00.000Z", design: "Shared Design", channel: "Retail", sizeRun: "Mixed", type: "Production In", pairs: 5, note: "" },
      { id: "4", createdAt: "2026-08-01T00:00:00.000Z", design: "Shared Design", channel: "Retail", sizeRun: "Mixed", type: "Purchase In", pairs: 4, note: "" },
      { id: "5", createdAt: "2026-08-02T00:00:00.000Z", design: "Factory Sandal", channel: "Factory", sizeRun: "36-41", type: "Damage Out", pairs: 3, note: "torn" },
      { id: "6", createdAt: "2026-08-03T00:00:00.000Z", design: "Resale Shoe", channel: "Retail", sizeRun: "Mixed", type: "Damage Out", pairs: 2, note: "lost" },
    ],
  };
}

describe("stock overview", () => {
  it("separates manufactured, purchased, mixed, and opening ready stock", () => {
    const result = buildStockOverview(operationsFixture(), []);

    expect(result.manufactured.map((row) => row.id)).toEqual(["m"]);
    expect(result.purchased.map((row) => row.id)).toEqual(["p"]);
    expect(result.mixed.map((row) => row.id)).toEqual(["x"]);
    expect(result.opening.map((row) => row.id)).toEqual(["o"]);
    expect(result.summary.readyPairs).toBe(45);
  });

  it("calculates raw-material on-hand and reorder status", () => {
    const result = buildStockOverview(operationsFixture(), []);
    expect(result.rawMaterials[0]).toMatchObject({ onHand: 35, needsReorder: true });
  });

  it("shows catalog stock as a sellable view without adding it to ready stock", () => {
    const product = { stock: 7 } as Product;
    const result = buildStockOverview(operationsFixture(), [product]);
    expect(result.summary.sellableCatalogPairs).toBe(7);
    expect(result.summary.readyPairs).toBe(45);
  });

  it("totals pairs written off as damaged or lost, across designs", () => {
    const result = buildStockOverview(operationsFixture(), []);
    expect(result.summary.damagedPairs).toBe(5); // 3 torn + 2 lost
    // A write-off is not a sale and not a source, so it changes neither the
    // origin buckets nor ready stock.
    expect(result.summary.readyPairs).toBe(45);
    expect(result.manufactured.map((row) => row.id)).toEqual(["m"]);
  });
});
