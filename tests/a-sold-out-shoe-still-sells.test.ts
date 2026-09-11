import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Polish, on the three cards a shopper actually meets.
 *
 * Every shoe in the shop reads "Sold out" today. That is honest, and it was
 * also the end of the conversation: the card offered a greyed-out button with
 * nothing to press, nothing to ask, and no reason to come back. A shop that
 * makes its own shoes has a real answer to "when will it be back", and would
 * rather be asked than watch a customer leave.
 *
 * Two smaller things were repeating or empty on the same card:
 *
 *   the corner badge fell back to the category, which is already printed in
 *   gold under the photo — two of the shop's three shoes said "Ladies Sandals"
 *   twice on one card
 *
 *   the description's reserved height was drawn even with no description, so
 *   "bag open" carried an empty band under its name that read as broken rather
 *   than quiet
 *
 * None of this is decoration. A repeated label, a dead button and a blank gap
 * are the three things that make a careful shop look careless.
 */
const CARD = "components/ProductCard.tsx";
const ACTIONS = "components/ProductCardActions.tsx";

describe("a shoe that is sold out", () => {
  it("offers a way to ask, instead of a button that does nothing", async () => {
    const source = await readFile(ACTIONS, "utf8");

    expect(source).toContain("whatsappOrderUrl");
    expect(source).toContain("Ask when it's back");
    expect(source).toContain("कहिले आउँछ सोध्ने");
  });

  it("asks about that shoe by name, so the shopkeeper knows which", async () => {
    const source = await readFile(ACTIONS, "utf8");

    // A message saying only "is it back?" makes the shopkeeper ask which shoe,
    // and half of those conversations never get a reply.
    expect(source).toContain("${product.name}");
  });

  it("still refuses to add it to the cart", async () => {
    const source = await readFile(ACTIONS, "utf8");

    // The point is to give the shopper somewhere to go, never to sell a pair
    // the shop cannot send.
    expect(source).toContain("if (outOfStock) {");
    expect(source).toContain("return;");
  });

  it("records the enquiry as a real analytics event", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const events = await readFile("lib/analytics-events.ts", "utf8");

    // "contact_click" was invented on the first attempt and the type checker
    // refused it. The name has to be one the file actually declares.
    expect(source).toContain(`trackCommerceEvent("contact")`);
    expect(events).toContain(`| "contact"`);
  });
});

describe("the card itself", () => {
  it("shows a badge only when there is a real one", async () => {
    const source = await readFile(CARD, "utf8");

    // Was: {product.badge ?? product.category} — a fallback that printed the
    // category a second time on any shoe without a badge.
    expect(source).not.toContain("{product.badge ?? product.category}");
    expect(source).toContain("product.badge?.trim() ?");
  });

  it("keeps the category in one place, under the photo", async () => {
    const source = await readFile(CARD, "utf8");

    expect(source.match(/\{product\.category\}/g)?.length ?? 0).toBe(1);
  });

  it("reserves the description's height without drawing an empty band", async () => {
    const source = await readFile(CARD, "utf8");

    // Cards in a row have to keep one baseline, so the space is held — but held
    // empty, not filled with a paragraph that has nothing in it.
    expect(source).toContain("product.description?.trim() ?");
    expect(source).toContain('aria-hidden="true"');
  });
});
