import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { queryPostgres } from "@/lib/postgres/client";
import { addStockMovementToPostgres, deleteOperationRecordFromPostgres, getFinishedStockFromPostgres } from "@/lib/operations-postgres";
import { createPosInvoice } from "@/lib/pos";
import { addCustomerLedger, getOperationsData } from "@/lib/operations";
import { getProducts, syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { availableBySize, totalAvailable } from "@/lib/stock-by-size";
import { catalogStockWarnings } from "@/lib/stock-overview";

/**
 * A full lifecycle of one shoe, run against the real database and cross-verified
 * two ways at every step — the app's own reads on one side, a raw SQL count on
 * the other — so a discrepancy between what the code believes and what the rows
 * actually say cannot hide. Everything is on a throwaway design + customer,
 * deleted at the end; the shop's own data is never read or written.
 *
 *   node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/e2e-lifecycle-live.test.ts
 */
const D = "ZZ e2e lifecycle design";
const CUST = "ZZ e2e lifecycle customer";
const CH = "Wholesale" as const;

async function cleanup() {
  await queryPostgres("t", `DELETE FROM pos_invoices WHERE customer_name = $1`, [CUST]);
  await queryPostgres("t", `DELETE FROM ledger_transactions WHERE ledger_id IN (SELECT id FROM customer_ledgers WHERE customer_name = $1)`, [CUST]);
  await queryPostgres("t", `DELETE FROM customer_ledgers WHERE customer_name = $1`, [CUST]);
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM products WHERE name = $1`, [D]);
  await queryPostgres("t", `DELETE FROM order_items WHERE product_name = $1`, [D]);
}

// Raw truth, straight from the rows — the independent side of every cross-check.
async function rawShelf() {
  const rows = await queryPostgres<{ size_run: string; stock_pairs: number; sold_pairs: number; returned_pairs: number }>(
    "t",
    `SELECT size_run, stock_pairs, sold_pairs, returned_pairs FROM finished_stock WHERE design = $1 ORDER BY size_run`,
    [D],
  );
  const stock = rows.reduce((n, r) => n + Number(r.stock_pairs), 0);
  const sold = rows.reduce((n, r) => n + Number(r.sold_pairs), 0);
  const returned = rows.reduce((n, r) => n + Number(r.returned_pairs), 0);
  return { rows, stock, sold, returned };
}

// The identity every movement must preserve: on-shelf === made − out + back.
async function rawMovementBalance() {
  const rows = await queryPostgres<{ type: string; p: number }>(
    "t",
    `SELECT type, SUM(pairs) p FROM stock_movements WHERE design = $1 GROUP BY type`,
    [D],
  );
  let made = 0, out = 0, back = 0;
  for (const r of rows) {
    const n = Number(r.p);
    if (r.type === "Production In" || r.type === "Purchase In") made += n;
    else if (r.type === "Sale Out" || r.type === "Dispatch Out" || r.type === "Damage Out") out += n;
    else if (r.type === "Return In") back += n;
  }
  return { made, out, back, onShelf: made - out + back };
}

// The app's own view of what the shop can sell for this design.
async function appAvailable() {
  const fs = await getFinishedStockFromPostgres();
  return totalAvailable(fs, D, { channel: CH });
}

beforeAll(cleanup);
afterAll(cleanup);

describe.skipIf(!process.env.DATABASE_URL)("full shoe lifecycle, cross-verified", () => {
  it("holds books consistent from purchase through sale, return, damage, and size split", async () => {
    // A customer who owes enough that a later return has something to credit.
    const ledger = await addCustomerLedger({
      customerName: CUST, channel: CH, phone: "0000000000",
      cashPaid: 0, chequePaid: 0, creditGiven: 100000, balanceDue: 100000, creditLimit: 0,
    });

    // 1) PURCHASE IN — 100 pairs bought for resale.
    await addStockMovementToPostgres({ design: D, channel: CH, sizeRun: "Mixed", type: "Purchase In", pairs: 100, note: "e2e purchase" });
    {
      const shelf = await rawShelf();
      const bal = await rawMovementBalance();
      expect(shelf.stock).toBe(100);           // raw rows
      expect(bal.onShelf).toBe(100);            // movement identity
      expect(await appAvailable()).toBe(100);   // app read
      console.log("1) purchase 100  -> shelf", shelf.stock, "| app avail", await appAvailable());
    }

    // 2) ONLINE ORDER via POS Sale — 12 pairs sold over the counter/online.
    await createPosInvoice({
      channel: CH === "Wholesale" ? "Wholesale" : "Retail", kind: "Sale",
      customerName: CUST, phone: "0000000000", cashier: "test",
      paymentMethod: "Cash", paymentReference: "", ledgerId: ledger.id,
      invoiceDiscount: 0, tax: 0, paidAmount: 6000, note: "e2e sale",
      items: [{ sku: "", design: D, sizeRun: "Mixed", quantity: 12, rate: 500, discount: 0 }],
    });
    {
      const shelf = await rawShelf();
      const bal = await rawMovementBalance();
      expect(shelf.stock).toBe(88);   // 100 - 12
      expect(shelf.sold).toBe(12);    // sale tallied
      expect(bal.onShelf).toBe(88);   // made 100 - out 12
      expect(await appAvailable()).toBe(88);
      console.log("2) sell 12       -> shelf", shelf.stock, "sold", shelf.sold, "| app avail", await appAvailable());
    }

    // 3) RETURN — 4 of those come back to the sellable shelf.
    await createPosInvoice({
      channel: CH === "Wholesale" ? "Wholesale" : "Retail", kind: "Return",
      customerName: CUST, phone: "0000000000", cashier: "test",
      paymentMethod: "Cash", paymentReference: "", ledgerId: ledger.id,
      invoiceDiscount: 0, tax: 0, paidAmount: 0, note: "e2e return",
      items: [{ sku: "", design: D, sizeRun: "Mixed", quantity: 4, rate: 500, discount: 0 }],
    });
    {
      const shelf = await rawShelf();
      const bal = await rawMovementBalance();
      expect(shelf.stock).toBe(92);       // 88 + 4 back
      expect(shelf.returned).toBe(4);
      expect(shelf.sold).toBe(12);        // a return does not un-sell
      expect(bal.onShelf).toBe(92);       // 100 - 12 + 4
      expect(await appAvailable()).toBe(92);
      console.log("3) return 4      -> shelf", shelf.stock, "returned", shelf.returned, "| app avail", await appAvailable());
    }

    // 4) DAMAGE OUT — 5 pairs written off, not sold.
    await addStockMovementToPostgres({ design: D, channel: CH, sizeRun: "Mixed", type: "Damage Out", pairs: 5, note: "e2e damage" });
    {
      const shelf = await rawShelf();
      const bal = await rawMovementBalance();
      expect(shelf.stock).toBe(87);   // 92 - 5
      expect(shelf.sold).toBe(12);    // damage is not a sale
      expect(bal.onShelf).toBe(87);   // 100 - 12 - 5 + 4
      expect(await appAvailable()).toBe(87);
      console.log("4) damage 5      -> shelf", shelf.stock, "sold still", shelf.sold, "| app avail", await appAvailable());
    }

    // 5) SIZE SPLIT — move part of the pile into real sizes; total must not change.
    await addStockMovementToPostgres({ design: D, channel: CH, sizeRun: "36", type: "Purchase In", pairs: 10, note: "e2e size 36" });
    await addStockMovementToPostgres({ design: D, channel: CH, sizeRun: "37", type: "Purchase In", pairs: 8, note: "e2e size 37" });
    {
      const shelf = await rawShelf();
      const fs = await getFinishedStockFromPostgres();
      const bySize = availableBySize(fs, D, { channel: CH });
      expect(bySize.get("36")).toBe(10);          // its own row
      expect(bySize.get("37")).toBe(8);           // its own row
      expect(bySize.get("Mixed")).toBe(87);       // the pile is untouched
      expect(shelf.stock).toBe(105);              // 87 + 10 + 8
      expect(await appAvailable()).toBe(105);
      console.log("5) +size 36:10, 37:8 -> per-size", Object.fromEntries(bySize), "| total", await appAvailable());
    }

    // 6) CATALOG SYNC — the shop's number must equal the real pool, no drift, no phantom.
    const sync = await syncProductCatalogStockWithFinishedStock();
    {
      const [products, ops] = await Promise.all([getProducts({ includeDrafts: true }), getOperationsData()]);
      const product = products.find((p) => p.name === D);
      const shelf = await rawShelf();
      expect(product).toBeTruthy();
      expect(product!.stock).toBe(shelf.stock);   // catalog == real pool (105)
      const warnings = catalogStockWarnings(products, ops.finishedStock).filter((w) => w.productName === D);
      expect(warnings).toHaveLength(0);           // backed by a real pool -> no warning
      console.log("6) sync -> catalog stock", product!.stock, "== pool", shelf.stock, "| warnings", warnings.length, "| synced", sync.updatedProducts);
    }

    // FINAL cross-check: the two independent truths agree.
    const shelf = await rawShelf();
    const bal = await rawMovementBalance();
    expect(shelf.stock).toBe(bal.onShelf);        // rows == movement identity
    expect(shelf.sold).toBe(12);
    expect(shelf.returned).toBe(4);
    console.log("FINAL: rows", shelf.stock, "=== movement identity", bal.onShelf, "| sold", shelf.sold, "returned", shelf.returned);
  }, 120_000);
});
