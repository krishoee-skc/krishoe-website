import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Controls big enough for a thumb.
 *
 * The star row on the review form drew 28px stars and made the button exactly
 * that size. A star is the right size to look at and the wrong size to hit: a
 * thumb covers roughly 45px, so aiming for 4 and landing on 3 was easy — and
 * the form gives no second chance to notice, because the only feedback is the
 * very star that was mis-tapped. A customer would send a rating they did not
 * mean, and the shop would read it as what they thought of the shoes.
 *
 * The fix keeps the two sizes apart: the button is 44px (what the thumb hits),
 * the star inside stays 28px (what the eye sees).
 *
 * The same rule reaches the settings form, where the owner types the shop's
 * bank account number on a phone.
 */
const STARS = "components/ProductReviews.tsx";
const SETTINGS = "app/admin/settings/page.tsx";

describe("the star rating on a phone", () => {
  it("gives each star a 44px button, whatever size the star is drawn", async () => {
    const source = await readFile(STARS, "utf8");
    const control = source.slice(
      source.indexOf("export function StarRatingInput"),
      source.indexOf("/** One published review"),
    );

    expect(control.length, "StarRatingInput is missing").toBeGreaterThan(0);
    expect(control).toContain("h-11 w-11");
    // The star itself stays small; it is the button that grew.
    expect(control).toContain("h-7 w-7");
  });

  it("says which rating each star sets", async () => {
    const source = await readFile(STARS, "utf8");
    const control = source.slice(
      source.indexOf("export function StarRatingInput"),
      source.indexOf("/** One published review"),
    );

    // Five buttons with no names is what a screen reader heard before.
    expect(control).toContain("aria-label");
    expect(control).toContain("aria-pressed");
  });
});

/** Every storefront .tsx — what a customer taps, not the admin's own screens. */
async function storefrontFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    if (entry.name === "admin" || entry.name === "worker") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await storefrontFiles(full)));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("what a customer taps in the shop", () => {
  it("has no pill or button too small for a thumb", async () => {
    const files = [...(await storefrontFiles("app")), ...(await storefrontFiles("components"))];
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    files.forEach((file, index) => {
      const lines = sources[index].split("\n");
      lines.forEach((line, number) => {
        // Three shapes, and the third is the one that hid the shop's own bug:
        //   className="…"                     a plain string
        //   className={`… ${x}`}              a template that closes here
        //   className={`… ${                  a template that runs on
        // Reading only up to the end of the line catches the last shape too —
        // the fixed classes always sit before the first interpolation.
        const match =
          line.match(/className="([^"]*)"/) ??
          line.match(/className=\{`([^`$]*)/);
        if (!match) return;
        const classes = match[1];

        // A rounded control with small vertical padding and no floor on its
        // height lands around 30-38px. The shop's category filters were 38px:
        // the most-tapped control on the shop page, in a scroll rail, on a
        // phone.
        const rounded = /rounded-full|rounded-lg/.test(classes);
        const smallPadding = /\bpy-(0|0\.5|1|1\.5|2|2\.5)\b/.test(classes);
        const hasFloor = /min-h-1[1-9]|min-h-\[4[4-9]|\bh-1[1-9]\b/.test(classes);

        // The opening tag is usually a few lines above its className, and a
        // pill whose hover styles live in a conditional branch has none in its
        // static classes — which is exactly the shape the shop's own category
        // filters had, and why an earlier version of this test missed them.
        const opening = lines.slice(Math.max(0, number - 6), number + 1).join("\n");
        const interactive =
          /<(button|Link)\b/.test(opening) ||
          /<a\s/.test(opening) ||
          /hover:/.test(classes);

        if (rounded && smallPadding && !hasFloor && interactive) {
          offenders.push(`${file}:${number + 1}  ${classes.slice(0, 64)}`);
        }
      });
    });

    expect(
      offenders.join("\n"),
      "a control a customer taps is under 44px — give it min-h-11",
    ).toBe("");
  });
});

describe("the settings form on a phone", () => {
  it("leaves no input shorter than a thumb", async () => {
    const source = await readFile(SETTINGS, "utf8");
    const shortInputs = source
      .split("\n")
      .filter((line) => /className="rounded-lg border border-brand-green-line px-3 py-2/.test(line));

    // py-2 with text-sm is about 34px. The owner types the shop's bank account
    // number into one of these, digit by digit, on a phone.
    expect(
      shortInputs.join("\n"),
      "a settings input has no minimum height, so it renders about 34px tall",
    ).toBe("");
  });
});
