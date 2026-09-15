import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Buying shoes must say where they were put.
 *
 * A purchase already records how many pairs arrived — a "Purchase In" movement
 * writes finished_stock. What it never recorded is where those pairs went, so
 * every bought pair landed in the Stock screen's "No place" column and stayed
 * there until somebody remembered to cut a challan for goods that had not
 * travelled anywhere.
 *
 * The fix is one dropdown on the trading line — Factory or Shop — carried down
 * the same path the design and size run already take, and written with the same
 * placePairs() a challan uses. Additive, so two lines of the same shoe on one
 * bill add up instead of overwriting.
 *
 * These read the source rather than run the bill, because posting a purchase
 * needs a live database. What they can prove is that the field is carried at
 * every hop and dropped at none — which is exactly how this class of bug hides:
 * the form collects it, one layer forgets it, and the column stays empty.
 */

const FORM = "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx";
const ACTION = "app/admin/purchasing/actions.ts";
const SHARED = "lib/purchasing.ts";
const POSTGRES = "lib/purchasing-postgres.ts";

describe("the place is carried the whole way", () => {
  it("is collected on the form", async () => {
    const form = await readFile(FORM, "utf8");

    // A real control, not a hidden input: the owner picks it per line.
    expect(form).toContain("StockPlace");
    expect(form, "the row needs somewhere to hold it").toMatch(/place:\s*StockPlace/);
    expect(form, "posted under a name the action reads").toContain("}Place`");
  });

  it("is read by the server action", async () => {
    const action = await readFile(ACTION, "utf8");

    expect(action).toContain("}Place`");
    // Constrained to the two real places. A free string here would let a typo
    // create a third location that no screen ever shows.
    expect(action).toContain("stockPlaces");
  });

  it("survives the shared normaliser", async () => {
    const shared = await readFile(SHARED, "utf8");

    expect(shared, "PurchaseLineInput must carry it").toContain("place");
    expect(shared).toContain("StockPlace");
  });

  it("reaches the database write", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    expect(postgres).toContain("placePairs");
    expect(postgres, "imported from the module that owns stock_locations").toMatch(
      /import\s*\{[^}]*placePairs[^}]*\}\s*from\s*"@\/lib\/stock-transfers"/,
    );
  });
});

/**
 * Where the two place names are allowed to come from.
 *
 * The first version of this feature imported them straight from
 * lib/stock-transfers.ts, and the production build failed: that module pulls in
 * the Postgres client, which pulls in next/server, which cannot be bundled for
 * the browser. Two constants had dragged the database layer into a client
 * component.
 *
 * So they live in lib/stock-rules.ts, which imports nothing at all, and
 * stock-transfers re-exports them for the server callers that already had them.
 * Nothing but the build caught this, and the build is the slowest gate we have.
 */
describe("the client bundle stays clean", () => {
  it("takes the place names from the module with no imports", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form, "this is a client component").toContain('"use client"');
    expect(form).toContain('from "@/lib/stock-rules"');
    expect(form, "stock-transfers would pull in next/server").not.toContain(
      'from "@/lib/stock-transfers"',
    );
  });

  it("keeps stock-rules free of imports", async () => {
    const rules = await readFile("lib/stock-rules.ts", "utf8");

    expect(rules).toContain("stockPlaces");
    // The property the whole arrangement rests on. One import here — however
    // harmless it looks — can put next/server back in the browser bundle.
    expect(rules, "stock-rules must import nothing").not.toMatch(/^import\s/m);
  });
});

describe("what the write must not do", () => {
  it("places only trading goods, never raw material", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    // Raw material has no design and no size run; placing it would create a
    // stock_locations row for something that is not a pair of shoes.
    const materialBranch = postgres.slice(
      postgres.indexOf("if (row.material) {"),
      postgres.indexOf('type: "Purchase In"'),
    );

    expect(materialBranch.length, "the posting loop moved").toBeGreaterThan(0);
    expect(materialBranch, "raw material must not be placed").not.toContain("placePairs");
  });

  it("adds to a place rather than replacing it", async () => {
    const transfers = await readFile("lib/stock-transfers.ts", "utf8");

    // placePairs is the additive one; setPlaceCount overwrites and is for a
    // stocktake. Buying 20 more pairs must not erase the 60 already there.
    const place = transfers.slice(
      transfers.indexOf("async function placePairs"),
      transfers.indexOf("export type ReceiveTransferInput"),
    );

    expect(place.length, "placePairs moved").toBeGreaterThan(0);
    expect(place).toContain("stock_locations.pairs + EXCLUDED.pairs");
  });

  it("shares the bill's transaction", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    // The pairs, the place and the invoice commit together. A separate
    // connection here would let the stock land while the bill rolled back.
    const loop = postgres.slice(
      postgres.indexOf("for (const row of resolved) {"),
      postgres.indexOf("INSERT INTO purchase_invoices"),
    );

    expect(loop.length, "the posting loop moved").toBeGreaterThan(0);
    // `db` is the transaction's executor; a call that reached for the pool
    // directly would commit the place even when the bill rolled back.
    expect(loop, "must use the transaction's own executor").toMatch(/placePairs\(\s*db\s*,/);
  });
});
