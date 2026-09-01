import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

async function siteUrlWith(value: string | undefined) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = value;

  vi.resetModules();
  const { getSiteUrl, absoluteUrl } = await import("@/lib/seo");
  return { getSiteUrl, absoluteUrl };
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
  vi.resetModules();
});

describe("getSiteUrl", () => {
  // A value pasted into a hosting dashboard can pick up a trailing newline.
  // Production was serving `<loc>https://host\n/shop</loc>` in its sitemap
  // because of exactly this, so every whitespace shape is pinned here.
  it.each([
    ["https://krishoe-website.vercel.app\n", "trailing newline"],
    ["  https://krishoe-website.vercel.app  ", "surrounding spaces"],
    ["https://krishoe-website.vercel.app\r\n", "windows line ending"],
    ["\thttps://krishoe-website.vercel.app", "leading tab"],
  ])("strips %s (%s)", async (raw) => {
    const { getSiteUrl } = await siteUrlWith(raw);
    expect(getSiteUrl()).toBe("https://krishoe-website.vercel.app");
  });

  it("strips trailing slashes", async () => {
    const { getSiteUrl } = await siteUrlWith("https://krishoe-website.vercel.app///");
    expect(getSiteUrl()).toBe("https://krishoe-website.vercel.app");
  });

  /**
   * The fallback has to be a host that answers.
   *
   * It was https://krishoe.com, which nobody has registered — a request to it
   * gets no response at all. With this variable missing or blank, that address
   * would have gone into every canonical link, every sitemap entry and every
   * printed QR code, and Google would have been told the shop lives at a domain
   * that does not exist.
   *
   * Change this the day the domain is really bought, not in anticipation of it.
   */
  it("falls back to a host that actually resolves", async () => {
    // krishoe.com is now the live registered domain (on Vercel), so the fallback
    // resolves to it. It used to fall back to the vercel host, from the era when
    // krishoe.com was not registered.
    expect((await siteUrlWith(undefined)).getSiteUrl()).toBe("https://www.krishoe.com");
    expect((await siteUrlWith("   \n  ")).getSiteUrl()).toBe("https://www.krishoe.com");
  });

  it("builds an absolute URL with no stray whitespace inside it", async () => {
    const { absoluteUrl } = await siteUrlWith("https://krishoe-website.vercel.app\n");
    const url = absoluteUrl("/worker/login");

    expect(url).toBe("https://krishoe-website.vercel.app/worker/login");
    expect(url).not.toMatch(/\s/);
  });
});
