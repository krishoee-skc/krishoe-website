import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Why an expensive-looking palette read as a web page.
 *
 * The brand's own three colours were never the problem: a deep green, a near
 * black green, and a cream. What surrounded them was — every neutral in the
 * shop had been borrowed from a default palette and every one of them was
 * COOL. A bluish white behind the cards, a slate grey for body text, a green-
 * grey for captions, and a 10%-black drop shadow under every box.
 *
 * Cool neutrals beside gold read as a screen. The same gold on warm paper reads
 * as leather — which is what the shop actually sells. Nothing here changes a
 * brand colour; it changes what they sit on.
 *
 * The owner asked for the shop to look "more premium". This is the whole of it:
 * the shadows come off, and the greys stop being grey.
 */
const TAILWIND = "tailwind.config.js";
const GLOBALS = "app/globals.css";

/** A hex is warm when it carries at least as much red as blue. */
function isWarm(hex: string) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return r >= b;
}

describe("the colours the brand is set on", () => {
  it("keeps the three the brand is actually made of", async () => {
    const tailwind = await readFile(TAILWIND, "utf8");

    // Not up for redecoration. These are on the box and the signboard.
    expect(tailwind).toContain('green: "#0B4D3B"');
    expect(tailwind).toContain('"green-ink": "#10231D"');
    expect(tailwind).toContain('"cream-hero": "#F7EFE2"');
  });

  it("has warm paper for the sheets, not screen white", async () => {
    const tailwind = await readFile(TAILWIND, "utf8");

    expect(tailwind).toContain('paper: "#FDFBF7"');
    expect(tailwind).toContain('"paper-deep": "#FAF8F3"');
  });

  it("has no cool neutral left in the surfaces or the text", async () => {
    const globals = await readFile(GLOBALS, "utf8");
    const light = globals.slice(globals.indexOf(":root {"), globals.indexOf(".dark {"));

    for (const role of [
      "--background",
      "--surface",
      "--surface-sunken",
      "--surface-raised",
      "--hairline",
      "--hairline-soft",
      "--ink-body",
      "--ink-muted",
      "--ink-faint",
    ]) {
      const hex = light.match(new RegExp(`${role}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      expect(hex, role).toBeTruthy();
      expect(isWarm(hex!), `${role} is ${hex}`).toBe(true);
    }
  });

  it("draws a card with a hairline rather than a shelf edge", async () => {
    const tailwind = await readFile(TAILWIND, "utf8");
    const shadows = tailwind.slice(tailwind.indexOf("boxShadow: {"), tailwind.indexOf("boxShadow: {") + 400);

    // A 10%-black drop under every box is what a template does to make a box
    // visible. Depth here is a hint, and it is warm.
    expect(shadows).not.toContain("rgba(0, 0, 0");
    expect(shadows).toContain("rgba(59, 42, 24");
  });

  it("puts the storefront's sheets on paper, admin left for its own pass", async () => {
    const home = await readFile("app/page.tsx", "utf8");
    const faq = await readFile("app/faq/page.tsx", "utf8");

    expect(home).toContain("bg-brand-paper");
    expect(faq).toContain("bg-brand-paper");
  });
});
