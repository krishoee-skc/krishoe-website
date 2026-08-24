import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * What a shopper on a Nepali phone waits for before they see anything.
 *
 * The home page carries two hero banners — a portrait one for phones and a
 * landscape one for desktops — and shows exactly one of them, by CSS. Both were
 * marked to preload, and a preload link in the head knows nothing about the CSS
 * that hides an element: the browser fetches it either way, at whatever width
 * the sizes attribute claims. So every shopper on a phone downloaded the
 * desktop banner as well, at full viewport width, racing the banner they were
 * actually waiting to see, on a connection with no room for either.
 *
 * Next's own guidance for a pair like this (image.md, "you cannot use preload
 * or loading=eager because that would cause both images to load") is to leave
 * the loading lazy so only the displayed one is fetched, and to say which one
 * matters with fetchPriority.
 *
 * Measured, not guessed: LCP at the 75th percentile was 2.39s against Google's
 * 2.5s threshold, with the worst reading at 5.5s.
 */
const HOME = "app/page.tsx";

describe("the home page's two banners", () => {
  it("preloads neither, so a phone fetches only the one it shows", async () => {
    const home = await readFile(HOME, "utf8");
    const markup = home.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(markup).not.toContain("preload");
    expect(markup).not.toMatch(/^\s*priority$/m);
  });

  it("says which one matters instead", async () => {
    const home = await readFile(HOME, "utf8");

    const mobile = home.slice(home.indexOf("mobile-hero-krishoe-gold-v2.png"));
    const desktop = home.slice(home.indexOf('src="/images/hero-krishoe-gold-v2.png"'));

    expect(mobile.slice(0, 400)).toContain('fetchPriority="high"');
    expect(desktop.slice(0, 400)).toContain('fetchPriority="high"');
  });

  it("asks for a full-width image only on the screen that shows it", async () => {
    const home = await readFile(HOME, "utf8");

    const mobile = home.slice(home.indexOf("mobile-hero-krishoe-gold-v2.png"));
    const desktop = home.slice(home.indexOf('src="/images/hero-krishoe-gold-v2.png"'));

    // 100vw on both meant each banner was fetched at the full width of whatever
    // screen was asking, including the screen that would never show it.
    expect(mobile.slice(0, 400)).toContain('sizes="(max-width: 767px) 100vw, 1px"');
    expect(desktop.slice(0, 400)).toContain('sizes="(min-width: 768px) 100vw, 1px"');
  });
});

/**
 * hero-banner.png is 909KB, and it sits at low opacity behind two sign-in
 * forms. The admin page was already told to stop fetching it ahead of the form;
 * the worker page — used by people with the cheapest phones in the building —
 * was still marked urgent.
 */
describe("the photograph behind the sign-in forms", () => {
  it("never comes before the fields, on either door", async () => {
    for (const page of ["app/worker/login/page.tsx", "app/(admin-auth)/admin/login/page.tsx"]) {
      const source = await readFile(page, "utf8");
      const banner = source.slice(source.indexOf("/images/hero-banner.png"), source.indexOf("/images/hero-banner.png") + 400);

      expect(banner, page).toContain('loading="lazy"');
      expect(banner, page).not.toContain("preload");
    }
  });

  it("is not announced to a screen reader, being decoration", async () => {
    const worker = await readFile("app/worker/login/page.tsx", "utf8");
    const banner = worker.slice(worker.indexOf("/images/hero-banner.png"));

    expect(banner.slice(0, 400)).toContain('alt=""');
    expect(banner.slice(0, 400)).toContain("aria-hidden");
  });
});
