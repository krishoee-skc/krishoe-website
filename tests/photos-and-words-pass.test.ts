import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { clampPlacement, fitScales } from "@/app/admin/products/photos/PhotoCropper";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Photos framed 4:5 by the owner's finger, up to six with a cover, and the
 * shop's words made few and true (owner, 2026-10-02).
 */
describe("framing a photo", () => {
  it("knows the zoom that fills the frame and the one that fits the whole photo", () => {
    // A 900×1600 phone photo in a 320×400 frame.
    const { cover, contain } = fitScales(900, 1600, 320, 400);
    expect(cover).toBeCloseTo(320 / 900);
    expect(contain).toBeCloseTo(400 / 1600);
  });

  it("keeps a filled frame filled, and centres a photo smaller than the frame", () => {
    expect(clampPlacement({ scale: 1, x: 50, y: 50 }, 400, 500, 320, 400)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(clampPlacement({ scale: 1, x: -999, y: -999 }, 400, 500, 320, 400)).toEqual({ scale: 1, x: -80, y: -100 });
    expect(clampPlacement({ scale: 0.25, x: 0, y: 0 }, 900, 1600, 320, 400).x).toBeCloseTo((320 - 225) / 2);
  });

  it("frames every photo before it goes up, and lets the owner pick the cover or remove one", async () => {
    const card = await read("app/admin/products/photos/PhotoCard.tsx");
    expect(card).toContain("<PhotoCropper");
    expect(card).toContain("data-photo-strip");
    expect(card).toContain("setCoverPhotoAction");
    expect(card).toContain("removePhotoAction");
    const actions = await read("app/admin/products/photos/actions.ts");
    expect(actions).toContain("if (rest.length === 0) {");
    expect(actions).toContain('if (slot === "gallery" && product.gallery.length >= MAX_PHOTOS) {');
  });

  it("shows the shop's frame, 4:5, on the card and the shoe's page", async () => {
    expect(await read("components/ProductCard.tsx")).toContain("aspect-[4/5]");
    expect(await read("components/ProductGallery.tsx")).not.toContain("aspect-square");
  });
});

describe("few, true words", () => {
  it("drops the brochure lines", async () => {
    expect(await read("components/WhyChoose.tsx")).not.toContain("Order requests are captured clearly");
    expect(await read("components/BestSeller.tsx")).not.toContain("Most-loved styles, selected by repeat buyers.");
    expect(await read("components/About.tsx")).not.toContain("const promises = [");
    expect(await read("app/page.tsx")).toContain('<T en="Made by hand in Narayangadh." ne="नारायणगढमा हातले बनेका।" />');
  });

  it("says coming soon once, and hides tabs that would show the same shoes", async () => {
    // Since 2026-10-02 each coming-soon collection is its own faded tile with
    // the tag, in the sliding row, instead of one line of names.
    expect(await read("components/categories.tsx")).toContain("data-coming-soon={comingSoon || undefined}");
    expect(await read("components/BestSellerTabs.tsx")).toContain("const sameShelf =");
  });
});
