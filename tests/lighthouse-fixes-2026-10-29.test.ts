import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What the Lighthouse run of 2026-10-29 found, and what was changed for it.
 * The Facebook pixel and Google tags stay as they are (owner's choice).
 */
const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

describe("review thumbnails are thumbnails", () => {
  it("sends a 44px picture, not the full product photo", async () => {
    for (const file of ["components/Testimonials.tsx", "app/reviews/page.tsx"]) {
      const source = await read(file);
      expect(source, file).toContain('<SafeImage src={review.shoe.image} alt="" width={44} height={44} sizes="44px"');
      expect(source, file).not.toContain("<img src={review.shoe.image}");
    }
  });

  it("does the same for the shoe on the checkout strip", async () => {
    const source = await read("components/CheckoutClient.tsx");
    expect(source).toContain('<SafeImage src={first.image} alt="" fill sizes="48px" className="object-cover" />');
  });
});

describe("accessibility", () => {
  it("gives the skip link a target", async () => {
    const source = await read("components/SkipToContent.tsx");
    expect(source).toContain('document.querySelector("main")?.setAttribute("id", "main");');
    expect(source).toContain('href="#main"');
  });

  it("keeps the dock and the summary labels readable", async () => {
    expect(await read("app/admin/AdminQuickDock.tsx")).not.toContain("text-brand-muted-deep");
    expect(await read("components/admin/PageKit.tsx")).not.toContain("opacity-80");
  });

  it("makes the two small add-work links big enough to tap", async () => {
    const form = await read("app/admin/factory/add-work/WorkEntryForm.tsx");
    expect(form.match(/inline-flex min-h-6 items-center font-bold text-brand-green hover:underline/g)).toHaveLength(2);
  });

  it("steps the headings down one level at a time", async () => {
    expect(await read("app/product/[id]/page.tsx")).not.toContain("<h4");
    expect(await read("components/ProductReviews.tsx")).not.toContain("<h5");
    expect(await read("app/shop/ShopCatalogControls.tsx")).toContain('<h2 className="sr-only text-brand-green-ink">');
  });
});
