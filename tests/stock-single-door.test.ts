import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * One door for stock.
 *
 * Pairs arrive one of three ways — made, bought, or counted as opening stock —
 * and all three go through Operations into the same finished-stock pool. The
 * catalog is the selling view of that number.
 *
 * The product form used to offer a second door: a Stock box the owner could
 * type into, writing a number with nothing behind it. That is how 132 pairs
 * came to sit in the shop across 15 designs with no record of where they came
 * from, and no way for a sale to reduce them — the catalog said one thing and
 * the stock ledger said another, with nothing to say which was true.
 */
describe("product form", () => {
  it("does not offer a stock input", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");
    expect(form).not.toContain('name="stock"');
  });

  it("shows the count and points at where it changes", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");
    expect(form).toContain("product.stock");
    expect(form).toContain("/admin/operations");
  });
});

describe("product save", () => {
  it("keeps the stock Operations left, rather than reading the form", async () => {
    const source = await readFile("app/admin/actions.ts", "utf8");
    const body = source.slice(source.indexOf("export async function upsertProductAction"));
    const action = body.slice(0, body.indexOf("\n}\n"));

    expect(action).not.toContain('textValue(formData, "stock")');
    expect(action).toContain("existingProduct?.stock ?? 0");
  });

  it("starts a brand-new product at zero, not at a typed number", async () => {
    const source = await readFile("app/admin/actions.ts", "utf8");
    // No existing row means no pairs have been recorded anywhere yet; the first
    // real count comes from a Production In, Purchase In, or opening entry.
    expect(source).toContain("const stock = Math.max(0, existingProduct?.stock ?? 0);");
  });
});
