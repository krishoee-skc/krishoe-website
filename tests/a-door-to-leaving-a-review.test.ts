import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Customers could not find where to leave a review.
 *
 * They told the owner so, and they were right. The form had always worked and
 * had always been open to everyone — but the only way in was inside a single
 * shoe's page. To write a line you had to open the shop, find the exact pair
 * you had bought, and scroll to the bottom of it. Nothing in the menu, the
 * footer, the phone tab bar or the home page pointed anywhere near it.
 *
 * So the shoe became a field in the form rather than a place you must already
 * be standing, at one plain address: /review. That address is the point — it
 * can be turned into a QR code for the shop counter or printed on the bill, so
 * a customer holding the shoes can scan and write without hunting through the
 * app.
 *
 * The phone tab bar is deliberately untouched: its five slots (home, shop,
 * search, cart, account) are all part of buying, and taking one away to ask for
 * a review would cost the shop sales.
 */
const PAGE = "app/review/page.tsx";
const FORM = "components/ShopReviewForm.tsx";
const FOOTER = "components/Footer.tsx";
const HOME_SECTION = "components/Testimonials.tsx";
const ORDER = "app/order/[id]/page.tsx";
const TABS = "components/BottomTabBar.tsx";

describe("the page a review can be left on", () => {
  it("exists at /review, where a QR code can point", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("path: \"/review\"");
  });

  it("lets the writer pick the shoe, instead of requiring them to find it", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("name=\"productId\"");
    expect(form).toContain("Which shoe?");
  });

  it("offers only shoes the shop actually sells", async () => {
    const page = await readFile(PAGE, "utf8");

    // getProducts() without includeDrafts is Active-only. A review of a draft
    // could never be shown, so offering one would waste the writer's time.
    expect(page).toContain("await getProducts()");
    expect(page).not.toContain("includeDrafts");
  });

  it("sends through the same action as the product page", async () => {
    const form = await readFile(FORM, "utf8");

    // Not a second submission path: the rate limit, the Verified-purchase rule
    // and the moderation queue all come with it.
    expect(form).toContain(`from "@/app/actions"`);
    expect(form).toContain("submitReview(productId");
  });

  it("says the shop reads it before anything is shown", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("KRISHOE reads every review before it appears in the shop.");
  });

  it("says so plainly when the shop has nothing listed to review", async () => {
    const form = await readFile(FORM, "utf8");

    // Rather than an empty picker above a button that cannot work.
    expect(form).toContain("products.length === 0");
  });
});

describe("the doors that lead to it", () => {
  it("is in the footer, on every page", async () => {
    const footer = await readFile(FOOTER, "utf8");

    expect(footer).toContain(`{ href: "/review"`);
  });

  it("is under the reviews on the home page", async () => {
    const section = await readFile(HOME_SECTION, "utf8");

    expect(section).toContain(`href="/review"`);
  });

  it("is on the home page even before a single review exists", async () => {
    const section = await readFile(HOME_SECTION, "utf8");

    // The section used to return null with no reviews — so on the very day the
    // shop most needs one, the home page offered no way to leave it.
    expect(section).not.toContain("if (reviews.length === 0) return null;");
    const empty = section.slice(
      section.indexOf("if (reviews.length === 0)"),
      section.indexOf("return (\n    <section className=\"bg-brand-paper py-20\">\n      <div className=\"mx-auto max-w-7xl"),
    );
    expect(empty).toContain(`href="/review"`);
    // And it must still not invent praise to fill the space.
    expect(empty).not.toContain("★★★★★");
  });

  it("is on an order page for someone the signed-in invite cannot reach", async () => {
    const order = await readFile(ORDER, "utf8");

    // The pairs-to-review block needs a signed-in customer and a Closed order.
    // A guest, or an order still on its way, gets this instead.
    expect(order).toContain(`href="/review"`);
  });

  it("stays out of the phone tab bar, which is for buying", async () => {
    const tabs = await readFile(TABS, "utf8");

    // Five slots, all part of buying. Adding a sixth, or replacing one, would
    // cost the shop more than the review is worth.
    expect(tabs).not.toContain("/review");
  });
});
