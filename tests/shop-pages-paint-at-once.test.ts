import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The shop's own pages are made ahead of time (static), so their whole page is
 * in the first answer from the server. A loading.tsx beside one put a grey
 * skeleton in front of it instead: the real page — header included — sat
 * hidden in the same answer until React's script swapped it in, which on a
 * cheap phone was four to seven seconds after the photo had arrived. Measured
 * on the live shoe page, 2026-10-08: first picture 4.0 s with the skeleton,
 * 3.1 s without, and never the seven-second worst case.
 *
 * The admin screens keep theirs — they wait on the database, and there the
 * skeleton is what fills the wait (tests/busy-screens-have-a-loader.test.ts).
 */
describe("the shop's ready-made pages", () => {
  it.each(["app/product/[id]", "app/shop", "app/checkout", "app/cart", "app/contact", "app/wishlist"])(
    "%s shows the page itself first, not a skeleton",
    async (dir) => {
      expect(await exists(`${dir}/page.tsx`)).toBe(true);
      expect(await exists(`${dir}/loading.tsx`)).toBe(false);
    },
  );
});

/**
 * Google's own check of the shoe page (PageSpeed, Moto G Power, 2026-10-08):
 * performance 88, the shoe photo at 3.8 s. What held it up, and the
 * accessibility marks it took off.
 */
describe("what Google found on the shoe page", () => {
  const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

  it("fetches the header crest at its drawn size, not first and not at 1920 px", async () => {
    const navbar = await read("components/Navbar.tsx");
    const crest = navbar.slice(navbar.indexOf("<Image"), navbar.indexOf("/>", navbar.indexOf("<Image")));
    expect(crest).toContain('sizes="80px"');
    expect(crest).toContain('loading="eager"');
    expect(crest).not.toMatch(/^\s+priority$/m);
  });

  it("brings the stylesheet inside the page", async () => {
    expect(await read("next.config.js")).toMatch(/experimental: \{\n\s+inlineCss: true,/);
  });

  it("answers a shopper's review question instead of the admin gate's 401", async () => {
    const proxy = await read("proxy.ts");
    expect(proxy).toContain('const PUBLIC_API = new Set(["/api/products/review-access"]);');
    expect(proxy).toContain('if (PUBLIC_API.has(pathname.replace(/\\/+$/, ""))) return false;');
    // The rest of /api/products stays behind it.
    expect(proxy).toContain('pathname.startsWith("/api/products") ||');
  });

  it("keeps small words readable and headings in order", async () => {
    expect(await read("tailwind.config.js")).toContain('"gold-deep": "#84631A",');
    expect(await read("components/ShareProduct.tsx")).toContain("bg-[#1468D8]");
    expect(await read("components/ProductReviews.tsx")).not.toContain("text-gray-400");
    expect(await read("app/product/[id]/page.tsx")).toMatch(/<h2 className="mt-3 text-2xl font-black text-brand-green-ink md:text-3xl">\n\s+<T en="About this product"/);
  });
});