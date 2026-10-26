import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { colourSwatch } from "@/lib/shoe-colour";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The shop as the owner's sample after the Novo Shoes compare (2026-10-26,
 * "sudhar garnuparne sabai garau — bhayaka systemharu rakhera"): every part
 * the shop had stays, and the shoe is bigger and easier to choose.
 */
describe("the card", () => {
  it("says NEW on a new arrival's photo, and dots its colours", async () => {
    const card = await read("components/ProductCard.tsx");
    expect(card).toContain(") : product.newArrival ? (");
    expect(card).toContain("colourSwatch(colour)");
    // Everything it had stays: heart, stars, sizes, price, the cart button.
    for (const piece of ["<WishlistHeart product={product} />", "reviewStats.count > 0", "<CardSizes product={product} />", "{product.price}", "<ProductCardActions product={product} compact />"]) {
      expect(card, piece).toContain(piece);
    }
  });

  it("fits five sizes on a phone card", async () => {
    const sizes = await read("components/CardSizes.tsx");
    expect(sizes).toContain("px-[3px] text-[11.5px]");
  });

  it("knows the shop's own colour words", () => {
    expect(colourSwatch("cherry")).toBe("#7A1420");
    expect(colourSwatch("Black")).toBe("#1F1F1F");
  });
});

describe("the shop", () => {
  it("chooses by size and colour, and keeps Low for the admin", async () => {
    const controls = await read("app/shop/ShopCatalogControls.tsx");
    expect(controls).toContain("setSizeChoice((current) => (current === size ? \"\" : size))");
    expect(controls).toContain("hasSize(product, sizeChoice)");
    expect(controls).toContain('(["all", "ready"] as AvailabilityFilter[])');
    expect(controls).toContain('text("Ready now", "अहिले तयार")');
    // Search, sort and shelves stay.
    expect(controls).toContain('text("Filter these: name, colour", "यीमध्ये छान्नुहोस्: नाम, रङ")');
    expect(controls).toContain('<option value="rating-desc">');
  });
});

describe("the shoe's page", () => {
  it("shows where the shoe sits, and keeps every way to buy", async () => {
    const page = await read("app/product/[id]/page.tsx");
    expect(page).toContain('<nav aria-label="Breadcrumb"');
    const actions = await read("components/ProductDetailActions.tsx");
    for (const piece of ['text("Buy now", "अहिले किन्नुहोस्")', 'text("Add to cart", "कार्टमा थप्नुहोस्")', 'text("Order on WhatsApp", "WhatsApp बाट अर्डर")', 'text("Order on Viber", "Viber बाट अर्डर")', "<QuantitySelector", "toggleWishlist(product.id)"]) {
      expect(actions, piece).toContain(piece);
    }
    expect(actions).toContain('<div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">');
  });

  it("names a colour in capitals with its dot", async () => {
    const selector = await read("components/ProductOptionSelector.tsx");
    expect(selector).toContain("?? colourSwatch(name)");
    expect(selector).toContain('variant === "color" ? colourLabel(item) : item');
  });

  it("keeps the four promises in one row on a phone", async () => {
    expect(await read("components/TrustStrip.tsx")).toContain('<ul className="mt-5 grid grid-cols-4');
    expect(await read("app/page.tsx")).toContain("grid max-w-5xl grid-cols-4");
  });
});

describe("the home page", () => {
  it("has a search box always in view on a phone, opening the one search", async () => {
    expect(await read("app/page.tsx")).toContain("<PhoneSearchBar />");
    expect(await read("components/PhoneSearchBar.tsx")).toContain('new Event("krishoe:open-search")');
  });
});
