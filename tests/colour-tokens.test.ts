import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * How many colours the shop is allowed to invent.
 *
 * The storefront carried 63 distinct hard-coded hex values. Many were the same
 * colour twice over — #9AA6A1 beside #9AA29E, #F8F8F8 beside #F9FAF8 beside
 * #F7F8F5, #C9A24D beside the #C8A04D already defined as brand-gold. Nobody can
 * see the difference between those pairs, which is precisely the problem: it is
 * not a palette, it is drift, and drift is what makes a page feel assembled
 * rather than designed.
 *
 * They now point at the tokens in tailwind.config.js. What is still allowed to
 * be a raw hex is listed below, with the reason.
 */

/** Colours that belong to someone else, or to a shoe, and are not ours to unify. */
const ALLOWED = new Set([
  // Other companies' brand colours. Changing these makes the button stop
  // looking like the app it opens.
  "#25D366", // WhatsApp
  "#7360F2", // Viber
  "#1877F2", // Facebook
  // The sign-in card states its own colours because globals.css repaints
  // `bg-white` in dark mode, which once turned the card dark while its inputs
  // stayed unstyled. See tests/login-form-legibility.test.ts.
  "#FFFFFF",
  "#16211C",
  // The bottom tab bar's four pastel icon bubbles. A deliberate scheme, kept
  // together so it can be reconsidered as one decision rather than drifting
  // apart one file at a time.
  "#FFE4D5",
  "#B74D68",
  "#EEE5FF",
  "#7451A8",
  "#FFF0BF",
  "#8B6718",
  "#F8DFEF",
  "#A83E70",
  "#E84C79",
]);

const CUSTOMER_FILES = [
  "app/page.tsx",
  "app/about/page.tsx",
  "app/wholesale/page.tsx",
  "app/shop/ShopCatalog.tsx",
  "app/shop/ShopCatalogControls.tsx",
];

async function componentSources() {
  const names = (await readdir("components")).filter((name) => name.endsWith(".tsx"));
  const files = [
    // The shoe colour swatches live here — tan, silver, purple and the rest are
    // product data, not interface, and must stay exact.
    ...names.filter((name) => name !== "ProductOptionSelector.tsx").map((n) => `components/${n}`),
    ...CUSTOMER_FILES,
  ];

  return Promise.all(
    files.map(async (file) => ({ file, source: await readFile(file, "utf8") })),
  );
}

describe("the storefront palette", () => {
  it("uses tokens instead of inventing colours", async () => {
    const offenders: string[] = [];

    for (const { file, source } of await componentSources()) {
      // Tailwind classes only. Gradient stops inside linear-gradient() cannot
      // name a token, so those stay hex by necessity.
      for (const match of source.matchAll(/(?:bg|text|border|ring)-\[(#[0-9A-Fa-f]{6})\]/g)) {
        if (!ALLOWED.has(match[1].toUpperCase()) && !ALLOWED.has(match[1])) {
          offenders.push(`${file}: ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the near-duplicates from coming back", async () => {
    const all = (await componentSources()).map((entry) => entry.source).join("\n");

    // Each of these had a twin nobody could tell apart from a real token.
    for (const drifted of ["#9AA6A1", "#9AA29E", "#F9FAF8", "#F7F8F5", "#C9A24D", "#13221d"]) {
      expect(all, drifted).not.toContain(drifted);
    }
  });
});

describe("the tokens themselves", () => {
  it("defines every brand colour in one place", async () => {
    const config = await readFile("tailwind.config.js", "utf8");

    for (const token of ["cream-hero", "gold-label", "clay-deep", "clay-ink"]) {
      expect(config, token).toContain(token);
    }
  });
});
