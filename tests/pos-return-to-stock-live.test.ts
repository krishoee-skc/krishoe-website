import { afterAll, describe, expect, it } from "vitest";
import { queryPostgres } from "@/lib/postgres/client";
import { createPosInvoice } from "@/lib/pos";
import { addCustomerLedger } from "@/lib/operations";

// A design and a customer that exist only for this test, so the shop's own rows
// are never read or written.
const D = "ZZ return probe design";
const CUST = "ZZ return probe customer";

async function seed() {
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
  // 10 pairs on the shelf, 4 already sold — a normal, lived-in row.
  await queryPostgres(
    "t",
    `INSERT INTO finished_stock (id, design, channel, size_run, stock_pairs, sold_pairs, returned_pairs)
       VALUES ('zz-ret-fs', $1, 'Retail', 'Mixed', 10, 4, 0)`,
    [D],
  );
}

async function cleanup() {
  // Invoices (items are a JSONB column on the invoice, no separate table), then
  // movements, stock, ledger.
  await queryPostgres("t", `DELETE FROM pos_invoices WHERE customer_name = $1`, [CUST]);
  await queryPostgres("t", `DELETE FROM stock_movements WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM finished_stock WHERE design = $1`, [D]);
  await queryPostgres("t", `DELETE FROM ledger_transactions WHERE ledger_id IN (SELECT id FROM customer_ledgers WHERE customer_name = $1)`, [CUST]);
  await queryPostgres("t", `DELETE FROM customer_ledgers WHERE customer_name = $1`, [CUST]);
}

afterAll(cleanup);

async function shelf() {
  const rows = await queryPostgres<{ stock_pairs: number; sold_pairs: number; returned_pairs: number }>(
    "t",
    `SELECT stock_pairs, sold_pairs, returned_pairs FROM finished_stock WHERE design = $1 AND size_run = 'Mixed'`,
    [D],
  );
  return {
    stock: Number(rows[0]?.stock_pairs ?? 0),
    sold: Number(rows[0]?.sold_pairs ?? 0),
    returned: Number(rows[0]?.returned_pairs ?? 0),
  };
}

/**
 * A live check that a POS Return really puts pairs back on the sellable shelf —
 * the last unverified link in the return-to-stock chain. The source says a
 * Return bill emits a "Return In" movement (lib/pos.ts), and "Return In" adds to
 * both stockPairs and returnedPairs (lib/stock-rules.ts); this confirms the two
 * meet on a real database, end to end, through the same createPosInvoice the POS
 * form calls.
 *
 * Skips where there is no database, runs where there is:
 *
 *   node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/pos-return-to-stock-live.test.ts
 *
 * Works on a design and a customer of its own, deleted afterwards.
 */
describe.skipIf(!process.env.DATABASE_URL)("a POS Return adds pairs back to stock", () => {
  it("returns 3 pairs to the shelf and records them as returned", async () => {
    await seed();
    await cleanup(); // clear any leftover from a failed prior run, then re-seed
    await seed();
    expect(await shelf()).toEqual({ stock: 10, sold: 4, returned: 0 });

    // A return credits the customer's account, so it can only offset what they
    // already owe (lib/ledger-rules.ts). Give them the 1500 (3 × 500) the return
    // will hand back, as a real returning customer with an open balance would.
    const ledger = await addCustomerLedger({
      customerName: CUST,
      channel: "Retail",
      phone: "0000000000",
      cashPaid: 0,
      chequePaid: 0,
      creditGiven: 1500,
      balanceDue: 1500,
      creditLimit: 0,
    });

    await createPosInvoice({
      channel: "Retail",
      kind: "Return",
      customerName: CUST,
      phone: "0000000000",
      cashier: "test",
      paymentMethod: "Cash",
      paymentReference: "",
      ledgerId: ledger.id,
      invoiceDiscount: 0,
      tax: 0,
      paidAmount: 0,
      note: "zz return probe",
      items: [{ sku: "", design: D, sizeRun: "Mixed", quantity: 3, rate: 500, discount: 0 }],
    });

    // The three pairs are back on the shelf and marked as returned; the four that
    // were sold stay sold — a return does not un-sell the rest.
    expect(await shelf()).toEqual({ stock: 13, sold: 4, returned: 3 });
  }, 60_000);
});
