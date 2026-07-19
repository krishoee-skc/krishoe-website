import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertProduct = vi.fn();
const removeProduct = vi.fn();

vi.mock("@/lib/product-store", () => ({
  upsertProduct: (...args: unknown[]) => upsertProduct(...args),
  removeProduct: (...args: unknown[]) => removeProduct(...args),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("@/lib/admin-audit", () => ({ appendAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteProductAction, upsertProductAction } from "@/app/admin/actions";

function productForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("id", "prod-1");
  formData.set("name", "Ladies Heel");
  formData.set("sku", "LH-01");
  formData.set("priceValue", "120000");
  formData.set("image", "https://example.public.blob.vercel-storage.com/heel.jpg");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  upsertProduct.mockReset().mockResolvedValue(undefined);
  removeProduct.mockReset().mockResolvedValue(undefined);
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
    expect(state.message).toContain("duplicate key");
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
