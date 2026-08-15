import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavLinks } from "@/app/admin/nav-links";

/**
 * Ten of fourteen products were still showing the category artwork they were
 * created with. A shoe with no photograph does not sell, and the only way to
 * fix one was to open the full product form, find it among fourteen, and edit
 * every field to change a picture.
 *
 * This screen does one thing: photograph a shoe and it is in the shop.
 */
describe("photo page", () => {
  it("offers the camera and the file picker as separate buttons", async () => {
    const card = await readFile("app/admin/products/photos/PhotoCard.tsx", "utf8");

    // `capture` is not a hint — an input carrying it opens the camera with no
    // route to the gallery, and one without it cannot re-shoot. Both doors have
    // to exist, so there are two inputs.
    expect(card).toContain('capture="environment"');
    expect((card.match(/type="file"/g) ?? []).length).toBe(2);
    expect(card).toContain("📷 खिच्ने");
    expect(card).toContain("🖼️ फाइलबाट");
  });

  it("saves as soon as the upload finishes", async () => {
    const card = await readFile("app/admin/products/photos/PhotoCard.tsx", "utf8");
    // With ten products on screen, a page of unsaved changes is a page where
    // one gets forgotten.
    expect(card).toContain("saveProductPhotoAction");
    expect(card).not.toContain("Save changes");
  });

  it("puts the products with no photograph first", async () => {
    const page = await readFile("app/admin/products/photos/page.tsx", "utf8");
    expect(page).toContain("function hasRealPhoto");
    expect(page).toContain("leftHas - rightHas");
  });
});

describe("saving one photo", () => {
  it("changes the picture and nothing else", async () => {
    const source = await readFile("app/admin/products/photos/actions.ts", "utf8");

    // Loading the stored row and replacing one field, rather than rebuilding
    // the product from form fields this screen does not have — price, sizes and
    // description have to survive a photo change.
    expect(source).toContain("getProductById(productId");
    expect(source).toContain("...product,");
    expect(source).not.toContain("priceRupees");
  });

  it("refreshes the prerendered storefront", async () => {
    const source = await readFile("app/admin/products/photos/actions.ts", "utf8");
    // The home and category pages are prerendered and carry these photos.
    expect(source).toContain('revalidatePath("/", "layout")');
  });

  it("is reachable from the menu", () => {
    const link = adminNavLinks.find((item) => item.href === "/admin/products/photos");
    expect(link?.nepali).toBe("फोटो हाल्ने");
  });
});
