import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const CONTROLS = "components/NavbarControls.tsx";

/**
 * The phone bar has room for three controls.
 *
 * The file said so — "keep the top bar to brand + wishlist + cart + menu on
 * phones" — and I added a language button directly beneath that sentence. The
 * owner opened the shop on their iPhone and said the menu had been better
 * before. It had.
 *
 * A comment did not stop it. This does.
 */
describe("what sits on the phone bar", () => {
  it("keeps the top row to search, cart and menu", async () => {
    const source = await readFile(CONTROLS, "utf8");
    const bar = source.slice(
      source.indexOf('<div className="flex shrink-0 items-center gap-1.5'),
      source.indexOf("{isOpen ?"),
    );

    // Everything else on that row is desktop-only. Count what a phone sees.
    const controls = [...bar.matchAll(/<(?:button|Link)\b/g)].length;
    const desktopOnly = [...bar.matchAll(/hidden[^"]*lg:(?:block|grid|flex)/g)].length;

    expect(controls - desktopOnly).toBeLessThanOrEqual(3);
  });

  it("still lets a phone change language", async () => {
    const source = await readFile(CONTROLS, "utf8");
    const drawer = source.slice(source.indexOf("{isOpen ?"));

    // Taken off the bar, not taken away. It is the first thing in the drawer,
    // and LanguageInvite asks a first-time visitor outright.
    expect(drawer).toContain("<LanguageSwitch");
  });

  it("puts the language switch above the fold, not below the tiles", async () => {
    const source = await readFile(CONTROLS, "utf8");
    const drawer = source.slice(source.indexOf("{isOpen ?"));

    // It used to sit under the wishlist and cart tiles, off the bottom of a
    // phone screen — which is how a shop with a Nepali translation looked like
    // a shop without one.
    expect(drawer.indexOf('setLanguage("ne")')).toBeLessThan(drawer.indexOf('href="/wishlist"'));
  });
});

/**
 * The drawer used to hold the same four links as the bottom tab bar and nothing
 * else, so opening it gained the reader nothing.
 */
describe("what the menu is for", () => {
  it("offers the shelves a shopper came to browse", async () => {
    const source = await readFile(CONTROLS, "utf8");

    expect(source).toContain("const DRAWER_CATEGORIES");
    expect(source).toContain("किसिम अनुसार");
    for (const slug of ["ladies-sandals", "casual-shoes", "kids-collection"]) {
      expect(source, slug).toContain(slug);
    }
  });

  it("answers what a first-time buyer asks before paying", async () => {
    const source = await readFile(CONTROLS, "utf8");

    // Can I send it back, where is my order, do you sell in bulk.
    expect(source).toContain('href="/return-policy"');
    expect(source).toContain('href="/track-order"');
    expect(source).toContain('href="/wholesale"');
  });

  it("gives a way to reach a person", async () => {
    const source = await readFile(CONTROLS, "utf8");

    // A shop with no phone number on it reads as a shop with nobody behind it,
    // and here a call or a WhatsApp message is what actually gets used.
    expect(source).toContain("businessContact.phoneTel");
    expect(source).toContain("https://wa.me/");
    expect(source).toContain("कमलनगर, नारायणगढ, चितवन");
  });

  it("measures the drawer against the screen the phone actually has", async () => {
    const source = await readFile(CONTROLS, "utf8");

    // iPhone's address bar grows and shrinks as the page scrolls; h-full takes
    // the larger figure and the drawer runs off the bottom.
    expect(source).toContain("h-dvh w-[min(90vw,390px)]");
    expect(source).not.toContain("h-full w-[min(90vw,390px)]");
  });
});
