import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertProduct = vi.fn();
const removeProduct = vi.fn();
// The save reads the stored row to carry its stock forward — the form no longer
// supplies a number. beforeEach defaults it to "no such product yet".
const getProductById = vi.fn();
// The save also scans the catalog for a look-alike name — "Jeans Shoes" and
// "jeans shoes" are one product. beforeEach defaults it to an empty catalog.
const getProducts = vi.fn();

vi.mock("@/lib/product-store", () => ({
  upsertProduct: (...args: unknown[]) => upsertProduct(...args),
  removeProduct: (...args: unknown[]) => removeProduct(...args),
  getProductById: (...args: unknown[]) => getProductById(...args),
  getProducts: (...args: unknown[]) => getProducts(...args),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteProductAction, upsertProductAction } from "@/app/admin/actions";

function productForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("id", "prod-1");
  formData.set("name", "Ladies Heel");
  formData.set("sku", "LH-01");
  formData.set("priceRupees", "1200");
  formData.set("image", "https://example.public.blob.vercel-storage.com/heel.jpg");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  upsertProduct.mockReset().mockResolvedValue(undefined);
  removeProduct.mockReset().mockResolvedValue(undefined);
  getProductById.mockReset().mockResolvedValue(null);
  getProducts.mockReset().mockResolvedValue([]);
});

describe("saving a product refuses a look-alike name", () => {
  it("stops a second product whose name differs only by capitals", async () => {
    getProducts.mockResolvedValue([{ id: "prod-9", name: "ladies heel" }]);

    const state = await upsertProductAction(null, productForm({ name: "Ladies Heel" }));

    expect(state.ok).toBe(false);
    expect(state.message).toContain("ladies heel");
    expect(upsertProduct).not.toHaveBeenCalled();
  });

  it("lets a product keep its own name when edited", async () => {
    // The clash check has to skip the row being saved, or renaming nothing
    // would report the product as a duplicate of itself.
    getProducts.mockResolvedValue([{ id: "prod-1", name: "Ladies Heel" }]);

    const state = await upsertProductAction(null, productForm({ name: "Ladies Heel" }));

    expect(state.ok).toBe(true);
    expect(upsertProduct).toHaveBeenCalled();
  });
});

/**
 * Stock has one door, and it is not this form.
 *
 * Pairs arrive through Operations — made, bought, or counted as opening stock.
 * A number typed into the product form was a second, unbacked answer to "how
 * many are there": 132 pairs across 15 designs sat in the shop with no record
 * of where they came from, and a sale could not reduce them.
 */
describe("saving a product never sets stock", () => {
  it("carries forward the count Operations left on the stored product", async () => {
    getProductById.mockResolvedValue({ id: "prod-1", stock: 36 });

    await upsertProductAction(null, productForm());

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ stock: 36 });
  });

  it("ignores a stock value posted with the form", async () => {
    getProductById.mockResolvedValue({ id: "prod-1", stock: 36 });

    // Nothing renders this field any more, but a stale tab or a hand-made
    // request still can — and it must not move the count.
    await upsertProductAction(null, productForm({ stock: "9999" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ stock: 36 });
  });

  it("starts a brand-new product at zero", async () => {
    const formData = productForm();
    formData.delete("id");

    await upsertProductAction(null, formData);

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ stock: 0 });
    // No id means no stored row to read; nothing should be fetched.
    expect(getProductById).not.toHaveBeenCalled();
  });
});

// The owner uploaded a photo, pressed Save, and got the app's error page — the
// form and the photo URL gone with it. These pin down that a failed write comes
// back as a message the form can show instead of an exception that unmounts it.
describe("saving a product reports what happened", () => {
  it("reports success with the product name", async () => {
    const state = await upsertProductAction(null, productForm());

    expect(state.ok).toBe(true);
    expect(state.message).toContain("Ladies Heel");
  });

  it("keeps the photo the owner uploaded", async () => {
    await upsertProductAction(null, productForm());

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({
      image: "https://example.public.blob.vercel-storage.com/heel.jpg",
    });
  });

  it("returns a retry message instead of throwing when the connection drops", async () => {
    upsertProduct.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    const state = await upsertProductAction(null, productForm());

    expect(state.ok).toBe(false);
    expect(state.message).toContain("press Save again");
  });

  it("returns the real reason when the database genuinely refuses the row", async () => {
    upsertProduct.mockRejectedValue(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
    );

    const state = await upsertProductAction(null, productForm());

    expect(state.ok).toBe(false);
    // The database's refusal, explained rather than quoted: a shopkeeper can
    // act on "already exists" and not on "duplicate key value violates unique
    // constraint".
    expect(state.message).toContain("already exists");
  });
});

// The form asked for paisa. Editing a Rs. 1,799 heel, the owner typed 5000 for
// a Rs. 5,000 shoe — the natural reading — and the form was one press away from
// saving it as Rs. 50, undercutting the shop a hundredfold with every field
// looking correctly filled in. Nothing would have flagged it.
describe("prices are entered in rupees", () => {
  it("stores rupees as paisa", async () => {
    await upsertProductAction(null, productForm({ priceRupees: "1799" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({
      priceValue: 179_900,
      price: "Rs. 1,799",
    });
  });

  it("takes the wholesale rate in rupees too", async () => {
    await upsertProductAction(null, productForm({ wholesalePriceRupees: "1300" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ wholesalePriceValue: 130_000 });
  });

  it("keeps paisa whole when a price has decimals", async () => {
    await upsertProductAction(null, productForm({ priceRupees: "1799.99" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ priceValue: 179_999 });
  });

  it("treats a blank wholesale rate as none", async () => {
    await upsertProductAction(null, productForm({ wholesalePriceRupees: "" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({ wholesalePriceValue: 0 });
  });

  it("refuses to read a negative or nonsense price as a price", async () => {
    for (const entered of ["-500", "abc"]) {
      upsertProduct.mockClear();
      await upsertProductAction(null, productForm({ priceRupees: entered }));

      expect(upsertProduct.mock.calls[0][0]).toMatchObject({ priceValue: 0 });
    }
  });

  // What the owner actually typed, and what it must now mean.
  it("reads 5000 as Rs. 5,000 and not Rs. 50", async () => {
    await upsertProductAction(null, productForm({ priceRupees: "5000" }));

    expect(upsertProduct.mock.calls[0][0]).toMatchObject({
      priceValue: 500_000,
      price: "Rs. 5,000",
    });
  });
});

describe("deleting a product reports what happened", () => {
  it("refuses without an id rather than throwing", async () => {
    const state = await deleteProductAction(null, new FormData());

    expect(state.ok).toBe(false);
    expect(removeProduct).not.toHaveBeenCalled();
  });

  it("returns a retry message when the connection drops", async () => {
    removeProduct.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const formData = new FormData();
    formData.set("id", "prod-1");

    const state = await deleteProductAction(null, formData);

    expect(state.ok).toBe(false);
    expect(state.message).toContain("press Save again");
  });
});
