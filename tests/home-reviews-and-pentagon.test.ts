import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-02: the reviews page's box on the home page, with a button
 * per shoe; and every collection on the home page as a five-sided tile in a
 * row that slides.
 */
describe("the home page's reviews", () => {
  it("shows the average over the spread of stars, not a single pill", async () => {
    const source = await read("components/Testimonials.tsx");
    expect(source).toContain("summary.distribution.map((row) =>");
    expect(source).not.toContain("from ${summary.count} customers");
  });

  it("lets a shopper keep one shoe's reviews, counting only what is on the page", async () => {
    const source = await read("components/Testimonials.tsx");
    expect(source).toContain("const onHome = wallShoes(reviews);");
    expect(source).toContain('data-review-shoe={review.shoe?.id ?? "shop"}');
    expect(await read("components/ReviewFilter.tsx")).toContain('card.style.display = chosen !== "all"');
  });
});

describe("shop by style", () => {
  it("is a ten-sided stone for every collection that has shoes", async () => {
    // Five sides first; ten, gold over green, from the second compare (ख२).
    // Empty collections left out since 2026-10-08 — unless none has a shoe.
    const source = await read("components/categories.tsx");
    expect(source).toContain("const DECAGON =");
    expect(source).toContain("style={{ clipPath: DECAGON }}");
    expect(source).toContain("Object.values(shoeCounts).some((count) => count > 0)");
    expect(source).toContain(".filter((item) => !hideEmpty || (shoeCounts?.[item.slug] ?? 0) > 0)");
    expect(source).not.toContain("rounded-full shadow-sm ring-2");
  });

  it("slides by hand and never by itself", async () => {
    expect(await read("components/categories.tsx")).toContain("<SlideRail");
    const rail = await read("components/SlideRail.tsx");
    expect(rail).not.toContain("setInterval");
    expect(rail).toContain("scrollBy");
  });
});
