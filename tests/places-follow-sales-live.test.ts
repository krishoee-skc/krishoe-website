import { afterAll, describe, expect, it } from "vitest";

// The live half of tests/sales-take-pairs-off-a-place.test.ts: a real sale
// and a real return, through the same function the counter uses.
/**
 * A live check against a real Postgres, skipped where there is none (CI runs
 * without one on purpose). Works on a design of its own and deletes it after.
 */
const D = "ZZ place probe";

describe.skipIf(!process.env.DATABASE_URL)("a sale on a real database", () => {
  afterAll(async () => {
    const { queryPostgres } = await import("@/lib/postgres/client");
    await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM stock_locations WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
    await queryPostgres("t", `DELETE FROM products WHERE name = $1`, [D]);
  });

  it("takes a counter sale off the shop and a return puts it back", async () => {
    const { queryPostgres } = await import("@/lib/postgres/client");
    const { addStockMovementToPostgres } = await import("@/lib/operations-postgres");
    const { getStockByPlace } = await import("@/lib/stock-transfers");

    await queryPostgres("t", `INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs)
      VALUES ('zz-place-fs', $1, 'Retail', 'Mixed', 10)
      ON CONFLICT (design, channel, size_run) DO UPDATE SET stock_pairs = 10`, [D]);
    await queryPostgres("t", `INSERT INTO stock_locations (id, design, size_run, location, pairs)
      VALUES ('zz-place-shop', $1, 'Mixed', 'Shop', 4), ('zz-place-fac', $1, 'Mixed', 'Factory', 6)
      ON CONFLICT (design, size_run, location) DO NOTHING`, [D]);

    await addStockMovementToPostgres({ design: D, channel: "Retail", sizeRun: "Mixed", type: "Sale Out", pairs: 5, note: "" });
    let row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 5, shop: 0, factory: 5, unplaced: 0 });

    await addStockMovementToPostgres({ design: D, channel: "Retail", sizeRun: "Mixed", type: "Return In", pairs: 1, note: "" });
    row = (await getStockByPlace()).find((r) => r.design === D)!;
    expect(row).toMatchObject({ total: 6, shop: 1, factory: 5, unplaced: 0 });
  });
});
