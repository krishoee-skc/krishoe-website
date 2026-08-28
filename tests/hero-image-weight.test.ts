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

describe("the home page's hero banner", () => {
  // The two-banner era is over: a shopper on a phone once downloaded the
  // desktop banner as well, racing the one they were actually shown. The shop's
  // own complete banner (crest, Made in Nepal and tagline all in the artwork)
  // is served once from Blob now, so there is only ever one hero image to fetch
  // and no second one to waste a Nepali connection on.
  it("is one image, not two — so a phone fetches only the banner it shows", async () => {
    const home = await readFile(HOME, "utf8");

    expect(home).not.toContain("mobile-hero-krishoe-gold-v2.png");
    expect(home).toContain("public.blob.vercel-storage.com");
    // No preload link, which cannot see CSS and would fetch a hidden twin —
    // moot now, but the guard stays so a second banner cannot creep back.
    expect(home).not.toContain("preload");
  });

  it("prioritises the one hero as the LCP image", async () => {
    const home = await readFile(HOME, "utf8");
    const hero = home.slice(home.indexOf("public.blob.vercel-storage.com"));

    // With a single hero, priority is correct: it marks the largest paint so
    // the browser fetches it first, without a rival banner to load beside it.
    expect(hero.slice(0, 600)).toMatch(/priority/);
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
