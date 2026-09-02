import { afterAll, describe, expect, it } from "vitest";
import { queryPostgres } from "@/lib/postgres/client";
import { addStockMovementToPostgres, deleteOperationRecordFromPostgres } from "@/lib/operations-postgres";

// A design that exists only for this test, so the shop's own rows are untouched.
const D = "ZZ damage probe design";

async function seed() {
  // Start every run from the same shelf: 20 pairs at the factory, none sold.
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
  await queryPostgres(
    "t",
    `INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs)
       VALUES ('zz-dmg-fs', $1, 'Factory', 'Mixed', 20, 0, 0)`,
    [D],
  );
}

afterAll(async () => {
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
});

async function shelf() {
  const rows = await queryPostgres<{ stock_pairs: number; sold_pairs: number }>(
    "t",
    `SELECT stock_pairs, sold_pairs FROM finished_stock WHERE design = $1 AND channel = 'Factory' AND size_run = 'Mixed'`,
    [D],
  );
  return { stock: Number(rows[0]?.stock_pairs ?? 0), sold: Number(rows[0]?.sold_pairs ?? 0) };
}

/**
 * A live check that a Damage Out really takes pairs off the shelf — and never
 * counts them as a sale — the same way the challan test moves real pairs.
 *
 * Skips where there is no database, runs where there is:
 *
 *   node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/damage-out-live.test.ts
 *
 * It works on a design of its own and deletes it afterwards; the shop's own
 * rows are never read or written.
 */
describe.skipIf(!process.env.DATABASE_URL)("a Damage Out on live stock", () => {
  it("writes off the pairs, leaves sold untouched, and reverses cleanly", async () => {
    await seed();
    expect(await shelf()).toEqual({ stock: 20, sold: 0 });

    const move = await addStockMovementToPostgres({
      design: D,
      channel: "Factory",
      sizeRun: "Mixed",
      type: "Damage Out",
      pairs: 6,
      note: "zz damage probe",
    });

    // Six pairs gone from the shelf; not one counted as sold — the money stays honest.
    expect(await shelf()).toEqual({ stock: 14, sold: 0 });

    // Deleting the movement (an owner's undo) puts the six back, exactly.
    await deleteOperationRecordFromPostgres("stockMovement", move.id);
    expect(await shelf()).toEqual({ stock: 20, sold: 0 });
  }, 60_000);

  it("refuses to write off more than the shelf holds", async () => {
    await seed();
    await expect(
      addStockMovementToPostgres({
        design: D,
        channel: "Factory",
        sizeRun: "Mixed",
        type: "Damage Out",
        pairs: 21,
        note: "zz damage overshoot",
      }),
    ).rejects.toThrow(/only 20 pairs/);
    // The failed attempt left the shelf exactly as it was.
    expect(await shelf()).toEqual({ stock: 20, sold: 0 });
  }, 60_000);
});
