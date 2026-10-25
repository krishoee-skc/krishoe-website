import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { colourLabel } from "@/lib/colour-name";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The shop on a phone, as the owner's sample (2026-10-24, "1–8 and 9 ख"):
 * every part of each page kept, moved or tightened — nothing taken away.
 */
describe("1 · the foot of the shop", () => {
  it("marks what takes money today and keeps the rest on show as soon", async () => {
    const footer = await read("components/Footer.tsx");
    expect(footer).toContain('<T en="We accept" ne="भुक्तानी" />');
    expect(footer).toContain("✓ {method}");
    expect(footer).toContain('<T en="soon" ne="छिट्टै" />');
  });

  it("shows the whole email on a 44px row, and lets the help pills wrap", async () => {
    const footer = await read("components/Footer.tsx");
    expect(footer).not.toContain('className="truncate text-xs">{businessContact.email}');
    expect(footer).toContain("min-h-11 max-w-full items-center gap-1.5 break-all");
    expect(footer).toContain("flex w-full min-w-0 flex-col items-start");
    const help = footer.slice(footer.indexOf('<nav aria-label="Help"'), footer.indexOf('<nav aria-label="Help"') + 200);
    expect(help).toContain("flex-wrap");
    expect(help).not.toContain("overflow-x-auto");
  });
});

describe("2 · checkout", () => {
  it("puts the shoe and the total first on a phone, and the full review stays", async () => {
    const checkout = await read("components/CheckoutClient.tsx");
    expect(checkout).toContain('href="#order-review" data-checkout-strip');
    expect(checkout).toContain('<div id="order-review" className="scroll-mt-4">');
    expect(checkout).toContain("<OrderSummary");
  });

  it("holds the total and the next step at the foot, and the tab bar steps aside", async () => {
    const checkout = await read("components/CheckoutClient.tsx");
    expect(checkout).toContain("data-checkout-bar");
    expect(checkout).toContain('keyboardOpen ? "translate-y-[150%]" : ""');
    expect(checkout).toContain('text("Continue →", "अगाडि →")');
    const tabs = await read("components/BottomTabBar.tsx");
    expect(tabs).toContain('pathname.startsWith("/checkout")');
  });

  it("puts the sign-in note under the boxes, and the three ticks on one line on a phone", async () => {
    const checkout = await read("components/CheckoutClient.tsx");
    expect(checkout.indexOf("Sign in or create an account after ordering")).toBeGreaterThan(checkout.indexOf('name="name"'));
    const page = await read("app/checkout/page.tsx");
    expect(page).toContain("mt-3 flex flex-wrap gap-x-3 gap-y-1 sm:mt-5 sm:grid sm:grid-cols-3 sm:gap-2");
  });
});

describe("3 · the cart", () => {
  it("draws a line as a 68px photo beside the words on a phone", async () => {
    const cart = await read("components/CartClient.tsx");
    expect(cart).toContain("grid-cols-[68px_minmax(0,1fr)]");
    expect(cart).toContain("sm:grid-cols-[140px_1fr]");
    expect(cart).toContain("colourLabel(item.color)");
  });

  it("offers another pair, and holds the total and Checkout above the tab bar", async () => {
    const cart = await read("components/CartClient.tsx");
    expect(cart).toContain('title={text("Add another pair", "अर्को जोडी थप्ने")}');
    expect(cart).toContain("data-cart-bar");
    expect(cart).toContain("Order summary");
    expect(cart).toContain("Keep shopping");
  });

  it("reads a colour as a shopper does, without touching the stored one", () => {
    expect(colourLabel("cherry")).toBe("Cherry");
    expect(colourLabel("  white ")).toBe("White");
    expect(colourLabel("")).toBe("");
    expect(colourLabel(undefined)).toBe("");
  });
});

describe("4 · Add to cart", () => {
  it("has a row of its own on a phone, on one line", async () => {
    const actions = await read("components/ProductDetailActions.tsx");
    expect(actions).toContain("order-last inline-flex h-12 basis-full items-center justify-center gap-2 whitespace-nowrap");
  });
});

describe("5 · a shoe waiting for its photo", () => {
  it("looks the same in the size sheet as on its card, and says its colour is confirmed on the call", async () => {
    const sheet = await read("components/SizeSheet.tsx");
    expect(sheet).toContain("isStandInPhoto(live.image) ? (");
    expect(sheet).toContain('text(" · we confirm it on the call", " · फोनमा पक्का गर्छौं")');
  });
});

describe("6 · the shoe page", () => {
  it("gathers the details in one card", async () => {
    const page = await read("app/product/[id]/page.tsx");
    expect(page).toContain('<dl className="mt-10 divide-y divide-black/5 rounded-xl');
    for (const label of ["SKU", "Material", "Fit", "Delivery", "Payment", "Stock"]) {
      expect(page, label).toContain(`en: "${label}"`);
    }
  });

  it("shows what buyers said before the form, which a link or an empty list opens", async () => {
    const reviews = await read("components/ProductReviews.tsx");
    expect(reviews.indexOf("reviews.map((review)")).toBeLessThan(reviews.indexOf("<ReviewForm productId"));
    expect(reviews).toContain('id="write-review"');
    expect(reviews).toContain("useState(totalReviews === 0)");
    expect(reviews).toContain('window.location.hash !== "#write-review"');
    expect(await read("app/order/[id]/page.tsx")).toContain("#write-review");
  });
});

describe("7 · empty cart and checkout", () => {
  it("show the shoes themselves", async () => {
    expect(await read("components/CartClient.tsx")).toContain('<OtherPairs products={products} exclude={[]}');
    const checkout = await read("components/CheckoutClient.tsx");
    expect(checkout).toContain('<OtherPairs products={products} exclude={[]}');
    expect(checkout).toContain("<RecentlyViewed />");
    expect(await read("components/OtherPairs.tsx")).toContain("product.stock > 0");
  });
});

describe("9 ख · the chat button", () => {
  it("is 40px at the very edge on a phone, still clear of the tab bar", async () => {
    const chat = await read("components/AiAssistant.tsx");
    expect(chat).toContain("right-2 z-40 flex h-10 w-10 md:right-4 md:bottom-5 md:h-12 md:w-12");
  });
});
