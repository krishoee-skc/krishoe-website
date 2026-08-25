import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * How a page becomes slow without anybody writing slow code.
 *
 * /shop measured 5.5 seconds to show a shopper a shoe, and nothing on the page
 * was heavy: 22KB of HTML, 164KB of JavaScript, images under 50KB. The page was
 * slow because of where its content lived.
 *
 * One client component called `useSearchParams()` to read `?query=` from the
 * URL. That opts the component out of prerendering, and it sat inside a
 * `<Suspense fallback={<div className="min-h-[60vh]" />}>`. A boundary around a
 * component that cannot prerender means the FALLBACK is what gets baked into
 * the page — so what shipped as /shop was an empty box. Not one product, not
 * one photograph. The browser's preload scanner, which exists to start
 * downloading images while the HTML is still arriving, had nothing to find.
 * Every photograph waited for the JavaScript to arrive, parse and hydrate
 * before it was even requested.
 *
 * The trap is that every individual decision was defensible, and the build
 * output still says `○ /shop` — statically prerendered. It was: an empty page,
 * prerendered perfectly.
 *
 * These tests hold the shape, not the timing. A stopwatch here would measure
 * this machine; what matters is that the content is IN the page.
 */

/** Components that put a product in front of a shopper. */
const CATALOGUE = [
  "app/shop/ShopCatalogControls.tsx",
  "app/shop/ShopCatalog.tsx",
  "components/ProductCard.tsx",
];

describe("the shop page ships the shop", () => {
  it("reads the URL after mounting, not during render", async () => {
    for (const file of CATALOGUE) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");

      // useSearchParams() is the single call that emptied this page.
      expect(code, file).not.toContain("useSearchParams");
    }
  });

  it("still reads a search arriving in the URL", async () => {
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // Removing the bail-out must not quietly remove the feature: the site-wide
    // search box navigates to /shop?query=… and that has to keep working.
    expect(controls).toContain("window.location.search");
    expect(controls).toContain('get("query")');
  });

  it("has no fallback standing where the products should be", async () => {
    const catalog = await readFile("app/shop/ShopCatalog.tsx", "utf8");
    const code = catalog.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(code).not.toContain("<Suspense");
    expect(code).toContain("<ShopCatalogControls");
  });

  it("gives the first row of shoes to the preload scanner", async () => {
    const card = await readFile("components/ProductCard.tsx", "utf8");
    const controls = await readFile("app/shop/ShopCatalogControls.tsx", "utf8");

    // Above the fold loads eagerly; the rest stays lazy so a long catalogue
    // does not download itself.
    expect(card).toContain('loading={eager ? "eager" : "lazy"}');
    expect(controls).toContain("eager={index < 4}");
  });
});

/**
 * The same trap, anywhere else it could be set.
 *
 * A Suspense fallback is the right tool for content that genuinely arrives
 * late. It is the wrong tool for content the page is FOR — and the difference
 * is invisible in the build output, which reports both as prerendered.
 */
describe("no other shopper-facing page hides itself behind a fallback", () => {
  it("keeps useSearchParams out of the pages a shopper lands on", async () => {
    async function shopperFiles(dir: string, out: string[] = []): Promise<string[]> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (/\/(admin|worker|api)(\/|$)/.test(path)) continue;
        if (/Admin|Worker/.test(entry.name)) continue;
        if (entry.isDirectory()) await shopperFiles(path, out);
        else if (entry.name.endsWith(".tsx")) out.push(path);
      }
      return out;
    }

    // The landing pages: home, shop, category, product. An account or checkout
    // screen is behind a sign-in and is dynamic anyway.
    const landing = (await shopperFiles("app")).filter((file) =>
      /^app\/(page|shop|product)/.test(file),
    );

    for (const file of [...landing, ...(await shopperFiles("components")).filter((f) => f.includes("Product"))]) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
      expect(code, file).not.toContain("useSearchParams");
    }
  });
});

/**
 * The check that would actually have caught it.
 *
 * Every source rule above describes one way to empty a page. This one reads
 * what the build produced and asks the only question that matters: is the shop
 * in the shop page? It runs against the last build, so it is skipped when there
 * is none — a source test that silently passes on a stale tree is worse than no
 * test, and `npm run check` builds before this suite would matter in CI.
 */
describe("what the build actually put in the page", () => {
  it("has the products in /shop's HTML, not only in its data", async () => {
    let html: string;
    try {
      html = await readFile(".next/server/app/shop.html", "utf8");
    } catch {
      // No build on this tree. The source rules above still ran.
      return;
    }

    const images = (html.match(/<img/g) ?? []).length;

    // Two is what the broken page shipped: the logo and a tracking pixel. A
    // working page carries a row of shoes.
    expect(images).toBeGreaterThan(4);
    expect(html).toContain("_next/image");
  });
});
