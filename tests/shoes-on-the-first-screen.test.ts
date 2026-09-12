import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A banner that filled the whole screen.
 *
 * The owner opened the shop on a laptop and said the picture was too big. It
 * was, and the arithmetic says so: the artwork is 1536x1024, so at the old
 * max-w-6xl it drew 1152px wide and 768px tall. Above it sit the delivery
 * strip, the navigation and the promo line — 164px together — so the banner
 * ended 932px down a 780px screen. A shopper saw the banner, and nothing else,
 * until they scrolled. On a shop, that is the one thing the first screen must
 * not do.
 *
 * Narrowed to 768px the banner is 512px tall and ends at 676px, leaving room
 * for the trust badges and the top of the first row of shoes.
 *
 * Narrower rather than cropped, deliberately: the crest, the "MADE IN NEPAL"
 * panel and the sandal are all inside the picture, and the sandal sits low in
 * the frame — capping the height with object-cover would have cut its base off
 * and lost part of the brand mark.
 *
 * The phone was never the problem. At 390px the banner was already 239px, a
 * third of the screen, with 337px left below it.
 */
const HOME = "app/page.tsx";

/** The banner's own proportions, from the file it is served from. */
const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;

/** Delivery strip + navigation + promo line, above the banner. */
const CHROME = 164;

/** A common laptop viewport. */
const LAPTOP = 780;

describe("the banner's share of the first screen", () => {
  it("leaves room below it on a laptop", async () => {
    const home = await readFile(HOME, "utf8");
    const match = home.match(/md:max-w-(\d)xl/);

    expect(match, "the banner's desktop width is not set where expected").toBeTruthy();

    // Tailwind's max-w scale: 2xl=672, 3xl=768, 4xl=896, 5xl=1024, 6xl=1152.
    const widths: Record<string, number> = { "2": 672, "3": 768, "4": 896, "5": 1024, "6": 1152 };
    const width = widths[match![1]];
    const height = Math.round((width * ART_HEIGHT) / ART_WIDTH);

    expect(
      CHROME + height,
      `the banner ends ${CHROME + height}px down a ${LAPTOP}px screen — a shopper sees no shoes`,
    ).toBeLessThan(LAPTOP);
  });

  it("is no longer the full-width banner that caused it", async () => {
    const home = await readFile(HOME, "utf8");

    // max-w-6xl is 1152px, which made it 768px tall.
    expect(home).not.toContain("max-w-6xl overflow-hidden");
  });

  it("asks the image optimiser for the size it actually draws", async () => {
    const home = await readFile(HOME, "utf8");

    // Left at 1152px this would download half again as many pixels as it
    // shows, on a shop whose customers are often on phone data.
    expect(home).toContain('sizes="(min-width: 768px) 768px, 100vw"');
  });
});

describe("what was deliberately not done", () => {
  it("keeps the whole artwork rather than cropping its height", async () => {
    const home = await readFile(HOME, "utf8");
    const banner = home.slice(home.indexOf("One complete branded banner"), home.indexOf("Trust badges"));

    expect(banner.length, "the banner block moved").toBeGreaterThan(0);
    // object-cover with a fixed height would have cut the sandal's base and
    // part of the crest — both are inside the picture, not typed over it.
    expect(banner).toContain("h-auto w-full");
    expect(banner).not.toContain("object-cover");
  });

  it("still loads first, because it is the first thing seen", async () => {
    const home = await readFile(HOME, "utf8");
    const banner = home.slice(home.indexOf("One complete branded banner"), home.indexOf("Trust badges"));

    expect(banner).toContain("priority");
  });
});
