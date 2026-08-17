import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = [
  "NEXT_PUBLIC_FACEBOOK_URL",
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "NEXT_PUBLIC_TIKTOK_URL",
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

/**
 * Overrides the named platforms and explicitly blanks the rest, so a test says
 * exactly which profiles exist. lib/seo.ts ships real URLs as defaults, so
 * merely leaving a key unset would fall back to one rather than removing it.
 */
async function profilesWith(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    process.env[key] = values[key] ?? "";
  }

  vi.resetModules();
  return import("@/lib/seo");
}

/** Clears every override so the shipped defaults apply. */
async function profilesFromDefaults() {
  for (const key of KEYS) delete process.env[key];

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

  it("omits sameAs entirely when every value is blanked", async () => {
    const { organizationJsonLd } = await profilesWith({
      NEXT_PUBLIC_FACEBOOK_URL: "",
      NEXT_PUBLIC_INSTAGRAM_URL: "",
      NEXT_PUBLIC_TIKTOK_URL: "",
    });
    expect(organizationJsonLd().sameAs).toBeUndefined();
  });

  // The shipped defaults came from links the owner shared from the apps, which
  // arrive carrying per-share tracking tokens. Those belong nowhere near the
  // footer or the SEO sameAs fields, so the defaults stay canonical.
  //
  // A query string is not itself the problem — a Facebook Page with no username
  // is genuinely addressed as profile.php?id=<id>, and that is the permanent
  // address Facebook itself redirects to. The tracking tokens are the problem,
  // so they are what this forbids.
  it("ships canonical default profiles with no share tracking on them", async () => {
    const { businessSocialProfiles } = await profilesFromDefaults();
    const profiles = businessSocialProfiles();

    expect(profiles).toHaveLength(3);
    for (const profile of profiles) {
      expect(profile.url, profile.label).not.toMatch(
        /mibextid|igsi|utm_|_t=|_r=|share_url|rdid|fbclid/i,
      );
      expect(profile.url.startsWith("https://")).toBe(true);
      expect(profile.url).not.toMatch(/\s/);
    }
  });

  it("does not point the Facebook link at a share redirect", async () => {
    const { businessContact } = await profilesFromDefaults();
    // /share/<token>/ links can expire and are not the profile's real address.
    expect(businessContact.facebook).not.toContain("/share/");
  });

  /**
   * The footer link used to go to the owner's personal Facebook account, so a
   * shopper who tapped "Facebook" under the shop landed on a private profile.
   *
   * The business Page is a separate account with its own id — the one thing a
   * Meta Pixel and a paid ad can attach to. These two ids look alike and were
   * confused several times while setting the Page up, which is exactly why the
   * personal one is named here and refused by name.
   */
  it("points Facebook at the business Page, not the owner's profile", async () => {
    const { businessContact } = await profilesFromDefaults();

    expect(businessContact.facebook).toContain("61593622372780");
    expect(businessContact.facebook).not.toContain("61550727599279");
    expect(businessContact.facebook).not.toContain("krishna.abiral");
    expect(businessContact.facebook).not.toContain("/people/");
  });
});
