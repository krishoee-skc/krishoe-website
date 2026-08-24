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
    expect(layout).toContain('subsets: ["devanagari", "latin"]');
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
