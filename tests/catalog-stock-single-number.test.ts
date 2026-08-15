import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * One number for a design's catalog stock.
 *
 * The read used to be:
 *
 *   CASE WHEN branch context THEN COALESCE(branch_stock.stock, 0)
 *        ELSE COALESCE(branch_stock.stock, products.stock) END
 *
 * — so products.stock and branch_product_stock could each hold a different
 * answer to "how many pairs are there", and they did. Stale branch rows of 0
 * hid 170 pairs from the shop across Doctor Chappal, halka fom and jeans
 * shoes, while products.stock still said 100, 15 and 55. Another said 48 where
 * the stock ledger said 36.
 *
 * The branch table is kept — branch reporting and its row-level security still
 * rely on it — but it is no longer a second home for the catalog count.
 */
describe("catalog stock", () => {
  it("is read from one column", async () => {
    const source = await readFile("lib/product-store.ts", "utf8");
    const select = source.slice(source.indexOf("async function getProductsFromPostgres"));
    const query = select.slice(0, select.indexOf("return rows.map"));

    expect(query).toContain("products.stock AS stock");
    expect(query).not.toContain("LEFT JOIN branch_product_stock");
    expect(query).not.toContain("COALESCE(branch_stock.stock");
    expect(query).not.toContain("krishoe_admin_branch_context_enabled()");
  });

  it("is written to one column by the sync", async () => {
    const source = await readFile("lib/product-store.ts", "utf8");
    const sync = source.slice(
      source.indexOf("async function syncProductCatalogStockWithFinishedStockPostgres"),
    );
    const body = sync.slice(0, sync.indexOf("\n}\n"));

    expect(body).toContain("UPDATE products SET stock = $2");
    // Writing the branch row and then summing branches meant the same sync
    // produced a different number depending on who ran it.
    expect(body).not.toContain("branch_product_stock");
  });

  it("is never moved by saving a product", async () => {
    const source = await readFile("lib/product-store.ts", "utf8");
    const upsert = source.slice(source.indexOf("async function upsertProductPostgres"));
    const body = upsert.slice(0, upsert.indexOf("\n}\n"));

    // Editing a photo or a price used to write the branch row and recompute the
    // count — under a branch the owner had never stocked, that meant zero.
    expect(body).not.toContain("branch_product_stock");
  });
});
