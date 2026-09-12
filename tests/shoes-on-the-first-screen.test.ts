import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A banner that filled the whole screen.
 *
 * The owner opened the shop on a laptop and said the picture was too big. It
 * was, and the arithmetic says so: the artwork is 1536x1024, so at max-w-6xl it
 * drew 1152px wide and 768px tall. Above it sit the delivery strip, the
 * navigation and the promo line — 164px together — so the banner ended 932px
 * down a 780px screen. A shopper saw the banner, and nothing else, until they
 * scrolled. On a shop, that is the one thing the first screen must not do.
 *
 * The first fix narrowed it to 768px. That worked, but the owner then asked for
 * the opposite trade: full width on a desktop, and shorter — "chaudai purai
 * tara talako lambai ajhai kam".
 *
 * Both at once means the frame is shorter than the artwork's own proportions,
 * and something has to give: either the picture is cropped to fill the frame
 * (object-cover) or it sits inside the frame whole (object-contain) with bars
 * at the sides.
 *
 * It was measured rather than guessed. Decoding the PNG and finding the bright
 * pixels of each element:
 *
 *   crest (top-left)     y    0 - 275    the crown is on the first row
 *   MADE IN NEPAL        y   75 - 970
 *   sandal + plinth      y  154 - 1023   the plinth is on the last row
 *
 * Content touches both edges, so every height crop cuts brand mark or product.
 * Scoring each candidate window by the bright content it keeps, the
 * best-placed 2.42:1 crop still lost 13.8% — and rendering it showed exactly
 * what that 13.8% was: the crown and half the name off the KRISHOE crest.
 *
 * So: contain. Everything survives, full width, 476px tall, ending 640px down
 * the same 780px screen.
 *
 * (An earlier note in this file claimed content sat within 25%-85% of the
 * height and could be cropped safely. That was wrong. It came from averaging
 * the four corners into one "background" colour — but the corners are four
 * different colours, so the average matched nothing and every row scored as
 * full content. The numbers above come from the decoded pixels.)
 */
const HOME = "app/page.tsx";

/** The banner's own proportions, from the file it is served from. */
const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;

/** Delivery strip + navigation + promo line, above the banner. */
const CHROME = 164;

/** A common laptop viewport. */
const LAPTOP = 780;

/** Tailwind's max-w scale, in px. */
const MAX_W: Record<string, number> = { "2": 672, "3": 768, "4": 896, "5": 1024, "6": 1152 };

function banner(home: string) {
  return home.slice(home.indexOf("One complete branded banner"), home.indexOf("Trust badges"));
}

/**
 * The banner block with its explanatory comment stripped out.
 *
 * The comment says why object-cover was rejected, so a test that searched the
 * whole block for "object-cover" found the word in the reasoning and failed on
 * correct code. The guard belongs on the markup.
 */
function bannerMarkup(home: string) {
  // The slice begins inside the comment, so there is no opening `/*` left to
  // match on — cut from the start to where the comment closes instead.
  const block = banner(home);
  return block.slice(block.indexOf("*/") + 2);
}

describe("the banner's share of the first screen", () => {
  it("leaves room below it on a laptop", async () => {
    const home = await readFile(HOME, "utf8");
    const block = banner(home);

    const width = MAX_W[block.match(/max-w-(\d)xl/)?.[1] ?? ""];
    expect(width, "the banner's width is not set where expected").toBeGreaterThan(0);

    // The frame's height comes from the aspect ratio it is capped at, not from
    // the artwork — that is the whole point of the cap.
    const ratio = block.match(/aspect-\[(\d+)\/(\d+)\]/);
    expect(ratio, "the banner's height cap is not set where expected").toBeTruthy();

    const height = Math.round((width * Number(ratio![2])) / Number(ratio![1]));

    expect(
      CHROME + height,
      `the banner ends ${CHROME + height}px down a ${LAPTOP}px screen — a shopper sees no shoes`,
    ).toBeLessThan(LAPTOP);
  });

  it("is shorter than the artwork's own proportions, or the cap does nothing", async () => {
    const home = await readFile(HOME, "utf8");
    const block = banner(home);

    const width = MAX_W[block.match(/max-w-(\d)xl/)?.[1] ?? ""];
    const ratio = block.match(/aspect-\[(\d+)\/(\d+)\]/)!;
    const capped = (width * Number(ratio[2])) / Number(ratio[1]);
    const natural = (width * ART_HEIGHT) / ART_WIDTH;

    expect(capped, "the frame is no shorter than the picture — the cap is a no-op").toBeLessThan(natural);
  });

  it("runs the full width of the page on a desktop, as the owner asked", async () => {
    const home = await readFile(HOME, "utf8");

    expect(banner(home)).toContain("max-w-6xl");
  });

  it("asks the image optimiser for the size it actually draws", async () => {
    const home = await readFile(HOME, "utf8");

    // Understating this would serve a 768px file into a 1152px frame and the
    // crest would go soft on the widest screens.
    expect(banner(home)).toContain('sizes="(min-width: 1200px) 1152px, 100vw"');
  });
});

describe("what the shorter frame must not cost", () => {
  it("keeps the whole artwork rather than cropping its height", async () => {
    const home = await readFile(HOME, "utf8");
    const markup = bannerMarkup(home);

    // Measured from the decoded PNG: the crest's crown is on row 0 and the
    // plinth on row 1023, so object-cover cuts one or the other. Rendering the
    // best-scoring crop confirmed it beheaded the crest.
    expect(markup).toContain("object-contain");
    expect(markup).not.toContain("object-cover");
  });

  it("fills the bars beside it with the artwork's own edges, not flat black", async () => {
    const home = await readFile(HOME, "utf8");
    const block = banner(home);

    // Containing a 3:2 picture in a 2.42:1 frame leaves a bar each side. The
    // artwork's right edge is near-black (5,5,5) but its left edge is warm,
    // reaching 249,229,184 where the light falls — so a single flat fill drew
    // a visible seam down the left. A gradient carries both.
    expect(block).toContain("bg-[linear-gradient(90deg,");
  });

  it("leaves the phone alone, where the banner was never too tall", async () => {
    const home = await readFile(HOME, "utf8");
    const block = banner(home);

    // At 390px the uncropped banner is 239px — a third of the screen, with
    // 337px left below it. The cap is md: and up only, so a phone still gets
    // the picture at its own proportions with no bars at all.
    expect(block).toContain("h-auto w-full");
    expect(block).toContain("md:aspect-[");
    expect(block).toContain("md:object-contain");
  });

  it("still loads first, because it is the first thing seen", async () => {
    const home = await readFile(HOME, "utf8");

    expect(banner(home)).toContain("priority");
  });
});
