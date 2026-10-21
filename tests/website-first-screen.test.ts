import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** Owner, 2026-10-21, the website sample: 2 and 3 garau. */
describe("2 · a shoe's name, price and stock on the first screen of a phone", () => {
  it("shows the photo narrower on a phone, still in the 4:5 frame it was set in", async () => {
    const gallery = await read("components/ProductGallery.tsx");
    expect(gallery).toContain("mx-auto block aspect-[4/5] w-full max-w-[80%] cursor-zoom-in");
    expect(gallery).toContain("md:max-w-none");
    expect(gallery).not.toContain("aspect-square");
  });

  it("puts the other photos a dot away on a phone, and keeps the thumbnails from a tablet up", async () => {
    const gallery = await read("components/ProductGallery.tsx");
    expect(gallery).toContain('<div className="hidden grid-cols-4 gap-3 md:grid">');
    expect(gallery).toContain("onClick={() => showImage(src)}");
    expect(gallery).toContain('className="grid h-9 w-9 place-items-center"');
    expect(gallery).toContain('<span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 md:hidden">');
  });

  it("follows the photo closely on a phone", async () => {
    const page = await read("app/product/[id]/page.tsx");
    expect(page).toContain('<div className="grid gap-5 md:gap-12 lg:grid-cols-2 lg:gap-16">');
  });
});

describe("3 · the language question does not cover the first screen", () => {
  it("sits over the delivery strip, 44px, on a phone and tablet; at the foot from a laptop up", async () => {
    const invite = await read("components/LanguageInvite.tsx");
    expect(invite).toContain("fixed inset-x-0 top-0 z-[60]");
    expect(invite).toContain("pt-[env(safe-area-inset-top)]");
    expect(invite).not.toContain("bottom-[calc(6.25rem");
    expect(invite).toContain('className="min-h-9 flex-none rounded-full lg:min-h-10');
  });
});
