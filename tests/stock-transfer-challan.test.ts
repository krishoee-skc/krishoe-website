import { afterAll, describe, expect, it } from "vitest";
import { queryPostgres } from "@/lib/postgres/client";
import {
  createStockTransfer, receiveStockTransfer, getStockByPlace, getStockTransfers,
} from "@/lib/stock-transfers";

// A design that exists only for this test, so the shop's own rows are untouched.
const D = "ZZ probe design";

async function seed() {
  // Each test starts from the same shelf: 54 at the factory, nothing at the shop.
  await queryPostgres("t", `DELETE FROM stock_transfers WHERE note = 'zz-probe'`);
  await queryPostgres("t", `DELETE FROM stock_locations WHERE design = $1 AND location = 'Shop'`, [D]);
  await queryPostgres("t", `INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs)
    VALUES ('zz-fs', $1, 'Factory', 'Mixed', 54)
    ON CONFLICT (design, channel, size_run) DO UPDATE SET stock_pairs = 54`, [D]);
  await queryPostgres("t", `INSERT INTO stock_locations (id, design, size_run, location, pairs)
    VALUES ('zz-loc', $1, 'Mixed', 'Factory', 54)
    ON CONFLICT (design, size_run, location) DO UPDATE SET pairs = 54`, [D]);
}

afterAll(async () => {
  await queryPostgres("t", `DELETE FROM stock_transfers WHERE note = 'zz-probe'`);
  await queryPostgres("t", `DELETE FROM stock_locations WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
});

const only = (rows: Awaited<ReturnType<typeof getStockByPlace>>) => rows.find((r) => r.design === D)!;

describe("a challan from the factory to the shop", () => {
  it("leaves, waits on the road, and arrives short", async () => {
    await seed();
    expect(only(await getStockByPlace())).toMatchObject({ factory: 54, shop: 0, total: 54, unplaced: 0 });

    const challan = await createStockTransfer({
      sentDate: "2026-08-27", fromLocation: "Factory", toLocation: "Shop",
      sentBy: "krishna", carriedBy: "raju", note: "zz-probe", receiveNow: false,
      submissionKey: "zz-" + Date.now(),
      items: [{ design: D, sizeRun: "Mixed", pairs: 10 }],
    });
    console.log("challan:", challan.challanNumber, challan.status);

    // In transit: gone from the factory, not yet at the shop, and SAID so.
    expect(only(await getStockByPlace())).toMatchObject({ factory: 44, shop: 0, total: 54, unplaced: 10 });

    const item = (await getStockTransfers(5)).find((t) => t.id === challan.id)!.items[0];
    const done = await receiveStockTransfer({
      transferId: challan.id, receivedBy: "shop", counted: { [item.id]: 8 },
    });
    console.log("received:", done.signal, done.receivedPairs, "of", done.sentPairs);

    expect(done.signal).toBe("Short");
    expect(only(await getStockByPlace())).toMatchObject({ factory: 44, shop: 8, total: 54, unplaced: 2 });
  }, 60_000);

  it("refuses to send more than the place holds", async () => {
    await seed();
    await expect(createStockTransfer({
      sentDate: "2026-08-27", fromLocation: "Factory", toLocation: "Shop",
      sentBy: "krishna", carriedBy: "", note: "zz-probe", receiveNow: false,
      submissionKey: "zz-over-" + Date.now(),
      items: [{ design: D, sizeRun: "Mixed", pairs: 999 }],
    })).rejects.toThrow(/54 pairs/);
  }, 60_000);

  it("carries and receives in one press when the tick is set", async () => {
    await seed();
    const challan = await createStockTransfer({
      sentDate: "2026-08-27", fromLocation: "Factory", toLocation: "Shop",
      sentBy: "krishna", carriedBy: "krishna", note: "zz-probe", receiveNow: true,
      submissionKey: "zz-now-" + Date.now(),
      items: [{ design: D, sizeRun: "Mixed", pairs: 12 }],
    });
    console.log("one press:", challan.status, challan.signal);

    expect(challan.status).toBe("Received");
    expect(only(await getStockByPlace())).toMatchObject({ factory: 42, shop: 12, unplaced: 0 });
  }, 60_000);
});
