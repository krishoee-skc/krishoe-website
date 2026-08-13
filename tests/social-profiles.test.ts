import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = [
  "NEXT_PUBLIC_FACEBOOK_URL",
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "NEXT_PUBLIC_TIKTOK_URL",
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

async function profilesWith(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  vi.resetModules();
  return import("@/lib/seo");
}

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
});

describe("business social profiles", () => {
  it("lists only the platforms that are configured", async () => {
    const { businessSocialProfiles } = await profilesWith({
      NEXT_PUBLIC_FACEBOOK_URL: "https://facebook.com/krishoe",
      NEXT_PUBLIC_TIKTOK_URL: "https://tiktok.com/@krishoe",
    });

    expect(businessSocialProfiles()).toEqual([
      { label: "Facebook", url: "https://facebook.com/krishoe" },
      { label: "TikTok", url: "https://tiktok.com/@krishoe" },
    ]);
  });

  // The same trap that put a newline inside the sitemap URLs: a value pasted
  // into a hosting dashboard arrives padded, and a plain truthiness check reads
  // whitespace as a real link — a dead footer link, and a malformed URL handed
  // to Google through sameAs.
  it("treats a whitespace-only value as not configured", async () => {
    const { businessSocialProfiles } = await profilesWith({
      NEXT_PUBLIC_FACEBOOK_URL: "   ",
      NEXT_PUBLIC_INSTAGRAM_URL: "\n",
    });

    expect(businessSocialProfiles()).toEqual([]);
  });

  it("trims padding off a configured URL", async () => {
    const { businessSocialProfiles } = await profilesWith({
      NEXT_PUBLIC_INSTAGRAM_URL: "  https://instagram.com/krishoe\n",
    });

    expect(businessSocialProfiles()).toEqual([
      { label: "Instagram", url: "https://instagram.com/krishoe" },
    ]);
  });

  it("keeps every label even when two platforms share a URL", async () => {
    const shared = "https://example.com/krishoe";
    const { businessSocialProfiles } = await profilesWith({
      NEXT_PUBLIC_FACEBOOK_URL: shared,
      NEXT_PUBLIC_INSTAGRAM_URL: shared,
    });

    expect(businessSocialProfiles().map((profile) => profile.label)).toEqual([
      "Facebook",
      "Instagram",
    ]);
  });

  it("feeds the same clean URLs to structured data", async () => {
    const { businessSocialLinks, organizationJsonLd } = await profilesWith({
      NEXT_PUBLIC_FACEBOOK_URL: " https://facebook.com/krishoe ",
    });

    expect(businessSocialLinks()).toEqual(["https://facebook.com/krishoe"]);
    expect(organizationJsonLd().sameAs).toEqual(["https://facebook.com/krishoe"]);
  });

  it("omits sameAs entirely when nothing is configured", async () => {
    const { organizationJsonLd } = await profilesWith({});
    expect(organizationJsonLd().sameAs).toBeUndefined();
  });
});
