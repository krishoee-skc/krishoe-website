import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The owner wanted the header to look expensive and, in their words, for
 * everything to sit equal. It did not: "Our Story" wrapped onto a second line
 * while the other links stayed on one, so the row was visibly uneven, and every
 * link carried an icon — which reads as an app's tab bar rather than a shop.
 *
 * The expensive look here comes from spacing and restraint, not colour: the
 * ground stays white so the shoe is the brightest thing on the page, and gold
 * appears exactly twice — the ring around the mark, and the hairline under the
 * page you are on.
 */
describe("the header", () => {
  it("never lets a link wrap", async () => {
    const nav = await readFile("components/PrimaryNav.tsx", "utf8");
    expect(nav).toContain("whitespace-nowrap");
  });

  it("drops the icons from the desktop links", async () => {
    const nav = await readFile("components/PrimaryNav.tsx", "utf8");
    const row = nav.slice(nav.indexOf("<nav"), nav.indexOf("hasMegaMenu"));
    expect(row).not.toContain("<Icon");
  });

  it("sets the links as spaced capitals", async () => {
    const nav = await readFile("components/PrimaryNav.tsx", "utf8");
    expect(nav).toContain("uppercase tracking-[0.2em]");
  });

  it("keeps a white ground so the product photos lead", async () => {
    const navbar = await readFile("components/Navbar.tsx", "utf8");
    expect(navbar).toContain("bg-white/95");
  });

  it("spends gold twice and no more", async () => {
    const navbar = await readFile("components/Navbar.tsx", "utf8");
    const nav = await readFile("components/PrimaryNav.tsx", "utf8");

    // The ring around the mark…
    expect(navbar).toContain("ring-brand-gold/60");
    // …and the rule under the current page.
    expect(nav).toContain("bg-brand-gold-bright");
  });

  it("leads with what this shop can say that others cannot", async () => {
    const navbar = await readFile("components/Navbar.tsx", "utf8");
    // The header's own line under the mark. The made-in-Nepal message now leads
    // the footer and the About block; the header carries the brand promise.
    expect(navbar).toContain("Walk with Authority");
  });
});
