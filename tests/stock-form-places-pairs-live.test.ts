import { afterAll, describe, expect, it } from "vitest";

// The live half of tests/stock-form-places-pairs.test.ts: the Operations
// "Stock movement" form's pairs get a place on a real Postgres.
/**
 * A live check against a real Postgres, skipped where there is none (CI runs
 * without one on purpose). Works on a design of its own and deletes it after.
 */
const D = "ZZ form place probe";

describe.skipIf(!process.env.DATABASE_URL)("the form on a real database", () => {
  afterAll(async () => {
    const { queryPostgres } = await import("@/lib/postgres/client");
    await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM stock_locations WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM products WHERE name = $1`, [D]);
  });

  it("leaves no pair without a place, and a later sale takes them off it", async () => {
    const { addStockMovementToPostgres } = await import("@/lib/operations-postgres");
    const { getStockByPlace } = await import("@/lib/stock-transfers");

    await addStockMovementToPostgres({ design: D, channel: "Factory", sizeRun: "Mixed", type: "Production In", pairs: 6, note: "", placeArrivals: true });
    let row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 6, factory: 6, shop: 0, unplaced: 0 });

    await addStockMovementToPostgres({ design: D, channel: "Factory", sizeRun: "Mixed", type: "Adjustment", pairs: 2, note: "", placeArrivals: true });
    row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 8, factory: 8, unplaced: 0 });

    await addStockMovementToPostgres({ design: D, channel: "Factory", sizeRun: "Mixed", type: "Sale Out", pairs: 3, note: "" });
    row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 5, factory: 5, unplaced: 0 });
  });

  it("without the form's ask, places nothing new (the factory and purchase paths place themselves)", async () => {
    const { addStockMovementToPostgres } = await import("@/lib/operations-postgres");
    const { getStockByPlace } = await import("@/lib/stock-transfers");
    await addStockMovementToPostgres({ design: D, channel: "Factory", sizeRun: "Mixed", type: "Production In", pairs: 1, note: "" });
    const row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 6, factory: 5, unplaced: 1 });
  });
});
