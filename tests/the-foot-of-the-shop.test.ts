import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The footer: a gold frame, and less of it down the page.
 *
 * The owner sent a screenshot and asked for three things — a border around the
 * edges (gold on the top and sides, green below), the same width, and less
 * height. Two of those are taste. The third was measurable, and so was a fault
 * nobody had asked about.
 *
 * Height. The old footer ran ~522px on a desktop. One column caused most of
 * it: Company's eight links stacked vertically came to 262px on their own —
 * half the footer, for eight words. The fix is not to drop links but to stop
 * stacking them: twenty links flowed through a grid occupy four rows instead
 * of eight, and the brand block and the offer share one line rather than two.
 *
 * Contrast, which the screenshot showed and the numbers confirmed. Deep green
 * type was being set at 55-85% opacity on the gold. Against the dark end of
 * the old gradient (#C0983B):
 *
 *   ink/55   2.15   "WALK WITH AUTHORITY"
 *   ink/75   2.89   links and body copy
 *   ink/85   3.37
 *   ink/100  4.15   still short
 *
 * WCAG AA asks 4.5 for body text. Every one of those failed, and the last line
 * is why full opacity alone was not enough — the gradient's dark end had to
 * come up too. At #CBA544 the same ink measures 4.79.
 *
 * These are the guards on all of it.
 */
const FOOTER = "components/Footer.tsx";

/** WCAG AA, body text. */
const AA = 4.5;

/** WCAG AA, icons and other non-text marks. */
const AA_LARGE = 3;

function channel(value: number) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The shop's own tokens, from tailwind.config.js. */
const INK = "#1A4238";
const GREEN = "#12634A";
const GOLD_BRIGHT = "#D4AF37";

describe("the type on the gold is readable", () => {
  it("clears AA at every stop of the gradient, not only the pale end", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const stops = footer.match(/#[0-9A-F]{6}/g) ?? [];

    // The gradient is declared in GOLD_GROUND; take the stops it names.
    const ground = footer.slice(footer.indexOf("const GOLD_GROUND"), footer.indexOf("/** Each social"));
    const golds = ground.match(/#[0-9A-F]{6}/g) ?? [];

    expect(stops.length, "no colours found in the file").toBeGreaterThan(0);
    expect(golds.length, "the gold gradient's stops moved").toBeGreaterThanOrEqual(3);

    for (const gold of golds) {
      expect(contrast(INK, gold), `deep green on ${gold}`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("does not dim the type back down with an opacity suffix", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const gold = footer.slice(footer.indexOf("<footer"), footer.indexOf("Bottom bar"));

    // This is what failed before: text-brand-green-ink/55, /70, /75, /85. At
    // full strength the worst stop is 4.79; at /85 it drops to 3.37.
    expect(gold).not.toMatch(/text-brand-green-ink\/\d+/);
  });

  it("keeps the medallion glyphs visible against their green", async () => {
    expect(contrast(GOLD_BRIGHT, GREEN)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("keeps the bottom bar's line from reading as switched off", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const bar = footer.slice(footer.indexOf("Bottom bar"));

    // white/70 measured 6.36 and passed, but sat beside bright payment pills
    // and read as disabled. white/85 is 8.59.
    expect(bar).toContain("text-white/85");
    expect(bar).not.toContain("text-white/70");
  });
});

describe("the frame the owner asked for", () => {
  it("draws gold down the sides and across the top", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const open = footer.slice(footer.indexOf("<footer"), footer.indexOf("{/* The brand"));

    expect(open).toContain("border-x-[3px]");
    expect(open).toContain("border-t-[3px]");
    expect(open).toContain("border-brand-gold");
  });

  it("closes it with a gold rule above the green band", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const bar = footer.slice(footer.indexOf("Bottom bar"));

    expect(bar).toContain("border-t-[3px] border-brand-gold");
    expect(bar).toContain("bg-brand-green-ink");
  });

  it("leaves the width alone, which the owner said was right", async () => {
    const footer = await readFile(FOOTER, "utf8");

    // Three rows, all still max-w-7xl: offer line, columns, bottom bar.
    expect(footer.match(/max-w-7xl/g)?.length).toBe(3);
  });
});

describe("shorter, without losing anything", () => {
  it("still offers every one of the twenty links", async () => {
    const footer = await readFile(FOOTER, "utf8");

    const shop = footer.slice(footer.indexOf("const shopLinks"), footer.indexOf("const companyLinks"));
    const company = footer.slice(footer.indexOf("const companyLinks"), footer.indexOf("const GOLD_GROUND"));

    expect(shop.match(/href:/g)?.length, "a Shop link was dropped").toBe(7);
    expect(company.match(/href:/g)?.length, "a Company link was dropped").toBe(8);

    // Both lists must actually be rendered — keeping the data but not drawing
    // it would pass the counts above and still lose the links.
    expect(footer).toContain("[...shopLinks, ...companyLinks]");
  });

  it("flows the links across a grid rather than stacking them", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const list = footer.slice(footer.indexOf("Links across, not down"), footer.indexOf('<T en="Contact"'));

    // Twenty links in one column ran 262px. In three columns they are 4 rows.
    expect(list).toContain("grid grid-cols-2");
    expect(list).toContain("sm:grid-cols-3");
    expect(list).not.toContain("space-y-2.5 text-sm text-brand-green-ink/85");
  });

  it("puts the brand and the offer on one line", async () => {
    const footer = await readFile(FOOTER, "utf8");
    const strip = footer.slice(footer.indexOf("{/* The brand"), footer.indexOf("Links across"));

    // They were two stacked blocks: a 2xl heading with a paragraph, then the
    // whole brand column below it. ~104px for six words.
    expect(strip).toContain("KRISHOE");
    expect(strip).toContain("5% off your first order");
    expect(strip).toContain("flex flex-wrap items-center");
  });

  it("spends less padding on empty space", async () => {
    const footer = await readFile(FOOTER, "utf8");

    // py-12 was 48px top and bottom on the columns alone, and py-6 another 24
    // on the offer strip above them — 144px of the old 522 was padding.
    expect(footer).not.toContain("py-12");

    // Every vertical padding in the footer is now 24px or less.
    for (const pad of footer.match(/\bpy-(\d+(?:\.5)?)\b/g) ?? []) {
      const rem = Number(pad.replace("py-", ""));
      expect(rem * 4, `${pad} is taller than 24px`).toBeLessThanOrEqual(24);
    }
  });
});

describe("what the footer still has to carry", () => {
  it("keeps the address tappable as directions", async () => {
    const footer = await readFile(FOOTER, "utf8");

    expect(footer).toContain("https://www.google.com/maps/search/?api=1&query=");
  });

  it("keeps phone, WhatsApp and email live", async () => {
    const footer = await readFile(FOOTER, "utf8");

    expect(footer).toContain("tel:${businessContact.phoneTel}");
    expect(footer).toContain("wa.me/${businessContact.whatsappNumber}");
    expect(footer).toContain("mailto:${businessContact.email}");
  });

  it("still names the shop's own social accounts", async () => {
    const footer = await readFile(FOOTER, "utf8");

    expect(footer).toContain("businessSocialProfiles()");
    expect(footer).toContain("<SocialGlyph");
  });
});
