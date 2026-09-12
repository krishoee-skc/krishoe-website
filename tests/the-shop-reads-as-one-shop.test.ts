import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Making the shop look like one shop.
 *
 * The owner asked for the whole storefront engineered, not one card polished,
 * and the measurements said the same thing. Seven sections carried four
 * different heading sizes and two weights; two of them were missing the shop's
 * own display face while the rest had it; cards sitting side by side used three
 * radii and three gaps. None of that is visible as a fault — the eye cannot
 * name it — but it reads as "not quite made by a professional", which is
 * exactly what the owner wanted to fix.
 *
 * The card was also 376px tall on a 360px phone, of which only 116px was the
 * photograph. The rest was reserved space: 92px held for a name that is usually
 * two words, 48px for a description many shoes do not have. Cards in a row have
 * to keep one baseline, but the grid does that; the card was paying for it
 * twice.
 *
 * One more thing, and the owner caught it rather than me: an earlier draft
 * called the shop a कारखाना. KRISHOE makes most of what it sells but also buys
 * some in — production_items has a Resale type — so that word would have been
 * half true on the day it shipped and false the day a bought-in pair arrived.
 */
const SECTIONS = [
  // Lowercase on disk and in its import. Windows does not care; Linux does,
  // and CI runs on Linux — this read threw ENOENT there while passing here.
  "components/categories.tsx",
  "components/BestSeller.tsx",
  "components/NewArrivals.tsx",
  "components/FeaturedProducts.tsx",
  "components/WhyChoose.tsx",
  "components/About.tsx",
  "components/Testimonials.tsx",
];

const HEADING = "font-display text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl";
const CARD = "components/ProductCard.tsx";

describe("every section heading is the same heading", () => {
  it("uses one scale across all seven", async () => {
    const sources = await Promise.all(SECTIONS.map((file) => readFile(file, "utf8")));
    const missing = SECTIONS.filter((_, index) => !sources[index].includes(HEADING));

    expect(missing.join(", "), "a section heading drifted off the scale").toBe("");
  });

  it("steps down for a phone rather than sitting at one size", async () => {
    const sources = await Promise.all(SECTIONS.map((file) => readFile(file, "utf8")));

    // Five of the seven were pinned at text-4xl, so a heading sized for a
    // desktop crowded a 360px screen.
    const pinned = SECTIONS.filter((_, index) => /text-4xl font-bold/.test(sources[index]));
    expect(pinned.join(", "), "a heading is back to one fixed size").toBe("");
  });

  it("wears the shop's own face everywhere, not on some sections only", async () => {
    const sources = await Promise.all(SECTIONS.map((file) => readFile(file, "utf8")));
    const plain = SECTIONS.filter((_, index) => !sources[index].includes("font-display text-3xl"));

    expect(plain.join(", ")).toBe("");
  });
});

describe("every section breathes the same", () => {
  it("gives a phone less air than a desktop", async () => {
    const sources = await Promise.all(SECTIONS.map((file) => readFile(file, "utf8")));
    const wrong = SECTIONS.filter((_, index) => !sources[index].includes("py-14 md:py-20"));

    // py-20 is 80px twice over — a quarter of a 360px phone spent on nothing,
    // between every row of shoes.
    expect(wrong.join(", "), "a section is back to one fixed padding").toBe("");
  });
});

describe("the card on a phone", () => {
  it("no longer reserves 92px for a two-word name", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).not.toContain("min-h-[5.75rem]");
  });

  it("no longer holds an empty band where a description would go", async () => {
    const card = await readFile(CARD, "utf8");

    // The band was drawn whether or not there was text for it.
    expect(card).not.toContain('className={compact ? "hidden md:block md:min-h-12"');
  });

  it("drops the one cool colour in a warm shop", async () => {
    const card = await readFile(CARD, "utf8");

    // silver-lt is 216° on the colour wheel; every other colour in the shop
    // sits at 37-43° or on the green. It was the photo's backdrop.
    expect(card).not.toContain("brand-silver-lt");
    expect(card).toContain("#FBF4E6");
  });

  it("sets the shoe's name in the display face", async () => {
    const card = await readFile(CARD, "utf8");
    const name = card.slice(card.indexOf("<h3"), card.indexOf("</h3>"));

    expect(name.length, "the product name heading moved").toBeGreaterThan(0);
    expect(name).toContain("font-display");
  });

  it("makes the price the figure it is, with its unit", async () => {
    const card = await readFile(CARD, "utf8");

    // It used to be smaller than the shoe's own name. The unit matters because
    // this shop sells wholesale as well as single pairs.
    expect(card).toContain("font-display font-black tracking-tight");
    expect(card).toContain('<T en="per pair" ne="प्रति जोडी" />');
  });

  it("stops colouring a sold-out shoe like a fault", async () => {
    const card = await readFile(CARD, "utf8");

    // brand-danger is the shop's colour for something wrong. Selling out is
    // the opposite of wrong.
    expect(card).not.toContain("bg-brand-danger");
    expect(card).toContain("bg-brand-green-ink/85");
  });
});

describe("what the shop calls itself", () => {
  it("never says it is a factory rather than a shop", async () => {
    const sources = await Promise.all(
      [...SECTIONS, CARD, "app/page.tsx"].map((file) => readFile(file, "utf8")),
    );

    // KRISHOE makes most of what it sells and buys some in — production_items
    // carries a Resale type — so a headline of "पसल होइन, कारखाना" would be
    // half true the day it shipped and false the day a bought-in pair is
    // listed. The owner caught that in a draft before it was built.
    //
    // Saying the shop is a factory AND a shop is a different claim and a true
    // one: About already says "कारखाना र पसल", WhyChoose says pairs are checked
    // before they leave it, and TrustStrip names the Narayangadh workshop.
    // Those stay. This guards the substitution, not the word.
    for (const source of sources) {
      expect(source).not.toContain("पसल होइन");
      expect(source).not.toContain("Not a shop");
    }
  });
});
