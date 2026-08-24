import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The half of the shop that had no typeface at all.
 *
 * Inter and Fraunces are loaded with `subsets: ["latin"]`, and a font cannot
 * render a letter it does not contain. So every Nepali word on this site fell
 * through to whatever the reader's device happened to have — Nirmala UI on
 * Windows, one Noto on an Android, another on the next, Devanagari Sangam on an
 * iPhone. The English was designed and the Nepali was borrowed, on the same
 * line, and the half of the shop written for its actual customers was the half
 * that looked unfinished.
 *
 * Nobody reported it, because it is invisible to anyone reading the English.
 */
const LAYOUT = "app/layout.tsx";
const GLOBALS = "app/globals.css";
const TAILWIND = "tailwind.config.js";

describe("the Nepali on this shop", () => {
  it("is drawn by a font the shop chose, not by whatever the phone had", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    expect(layout).toContain("Mukta");
    expect(layout).toContain("Tiro_Devanagari_Hindi");
    expect(layout).toContain('subsets: ["devanagari"]');
  });

  it("reaches the page, and not only the import list", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    // A next/font call that is never put on <html> loads nothing.
    expect(layout).toContain("devanagariSans.variable");
    expect(layout).toContain("devanagariDisplay.variable");
  });

  it("follows the Latin face in every stack rather than replacing it", async () => {
    const globals = await readFile(GLOBALS, "utf8");
    const tailwind = await readFile(TAILWIND, "utf8");

    // Order is the whole mechanism: a browser takes each letter from the first
    // font in the list that contains it, so Latin still comes from Inter and
    // Fraunces while Devanagari comes from these. Put first, they would take
    // the English too.
    for (const line of globals.split("\n").filter((l) => l.includes("font-family:"))) {
      expect(line, line.trim()).toMatch(/--font-dev-(sans|display)/);
    }

    expect(tailwind).toContain('"var(--font-sans)", "var(--font-dev-sans)"');
    expect(tailwind).toContain('"var(--font-display)", "var(--font-dev-display)"');
  });

  it("keeps the Latin faces the brand already had", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    // This is an addition, not a replacement. The shop's English is not up for
    // renegotiation because its Nepali was fixed.
    expect(layout).toContain("Inter");
    expect(layout).toContain("Fraunces");
  });
});

/**
 * What the Nepali cost, and what it should not have cost.
 *
 * Adding the two Devanagari families naively took the shop from 83KB of type to
 * 397KB, every file preloaded ahead of the page — on the mobile connections
 * this shop's customers actually use, that is a worse sin than the borrowed
 * font it was fixing. Almost a fifth of it was Latin glyphs inside the
 * Devanagari fonts that can never be drawn, because Inter and Fraunces come
 * first in every stack and a Latin letter never reaches them.
 */
describe("what the Nepali costs to draw", () => {
  it("asks these fonts for no Latin they will never be asked to draw", async () => {
    const layout = await readFile(LAYOUT, "utf8");
    const devanagari = layout.slice(layout.indexOf("const devanagariSans"));

    expect(devanagari).not.toContain('"devanagari", "latin"');
  });

  it("loads only the weights the shop sets", async () => {
    const layout = await readFile(LAYOUT, "utf8");
    const mukta = layout.slice(layout.indexOf("const devanagariSans"), layout.indexOf("const devanagariDisplay"));

    // Every extra weight is another whole Devanagari file — they run to 65KB
    // each, because the script has far more conjuncts than Latin has letters.
    expect(mukta).toContain('weight: ["400", "700"]');
  });

  it("keeps the heading face off the critical path", async () => {
    const layout = await readFile(LAYOUT, "utf8");
    const tiro = layout.slice(layout.indexOf("const devanagariDisplay"));

    // It draws headings only. A heading that settles a moment after the page
    // paints costs less than making every shopper wait 66KB for it first.
    expect(tiro.slice(0, 300)).toContain("preload: false");
  });
});
