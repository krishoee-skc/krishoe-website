import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { businessContact, localBusinessJsonLd } from "@/lib/seo";

/**
 * Being findable by somebody standing in Bharatpur.
 *
 * The SEO audit found the shop strong almost everywhere — a sitemap, a
 * ShoeStore schema, an llms.txt, and twelve AI crawlers allowed by name, which
 * most shops in Nepal do not have. Two things were missing, and both are about
 * the shop's own doorway rather than its catalogue:
 *
 *   no coordinates — an address says which town, only a point says how far,
 *   and "shoe shop near me" is ranked on how far
 *
 *   no Google verification — the shop is indexed but silent: nobody can see
 *   which words brought a shopper in, or ask Google to look again after a new
 *   shoe goes up
 *
 * A third is waiting on the owner: the Google Business Profile, the thing that
 * puts a shop in the map box above the ordinary results. The slot for it is
 * here and deliberately empty, because a sameAs pointing at nothing is worse
 * than no sameAs at all.
 */
describe("where the shop is, as a point on the map", () => {
  it("carries coordinates, not only an address", () => {
    const schema = localBusinessJsonLd() as Record<string, unknown>;
    const geo = schema.geo as Record<string, string> | undefined;

    expect(geo, "no geo on the ShoeStore schema").toBeTruthy();
    expect(geo?.["@type"]).toBe("GeoCoordinates");
    expect(Number(geo?.latitude)).toBeGreaterThan(0);
    expect(Number(geo?.longitude)).toBeGreaterThan(0);
  });

  it("puts the shop in Nepal, not somewhere a typo would land it", () => {
    // Nepal spans roughly 26-31 N and 80-89 E. A swapped pair, a dropped minus
    // or a pasted-in example would fall outside it, and the schema would send
    // shoppers to the wrong country without anything looking broken.
    const lat = Number(businessContact.latitude);
    const lng = Number(businessContact.longitude);

    expect(lat).toBeGreaterThan(26);
    expect(lat).toBeLessThan(31);
    expect(lng).toBeGreaterThan(80);
    expect(lng).toBeLessThan(89);
  });

  it("offers a map link built from those same numbers", () => {
    const schema = localBusinessJsonLd() as Record<string, unknown>;

    // Two places stating the location have to agree, or the schema argues with
    // itself about where the shop is.
    expect(schema.hasMap).toContain(businessContact.latitude);
    expect(schema.hasMap).toContain(businessContact.longitude);
  });

  it("can be moved to the exact doorway without touching code", async () => {
    const source = await readFile("lib/seo.ts", "utf8");

    // The default is Narayangadh's centre, looked up rather than guessed — the
    // town, not the shop's door.
    expect(source).toContain("NEXT_PUBLIC_BUSINESS_LAT");
    expect(source).toContain("NEXT_PUBLIC_BUSINESS_LNG");
  });
});

describe("letting Google report back", () => {
  it("emits a verification tag when the code is set", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");

    expect(layout).toContain("GOOGLE_SITE_VERIFICATION");
    expect(layout).toContain("google: process.env.GOOGLE_SITE_VERIFICATION.trim()");
  });

  it("leaves the Facebook tag working on its own", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");

    // Either, neither or both — one being set must not silence the other.
    expect(layout).toContain("FACEBOOK_DOMAIN_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION");
    expect(layout).toContain("facebook-domain-verification");
  });
});

describe("the Google Business Profile, once it exists", () => {
  it("has a slot that stays empty until there is one", () => {
    const schema = localBusinessJsonLd() as Record<string, unknown>;
    const sameAs = (schema.sameAs ?? []) as string[];

    // Empty today. A sameAs pointing at nothing is worse than none: it tells
    // Google the shop claims a profile it does not have.
    expect(sameAs.every((url) => url.startsWith("http"))).toBe(true);
    expect(sameAs.some((url) => url.trim() === "")).toBe(false);
  });

  it("joins the schema the moment the link is set", async () => {
    const source = await readFile("lib/seo.ts", "utf8");

    expect(source).toContain("NEXT_PUBLIC_GOOGLE_BUSINESS_URL");
    expect(source).toContain("...(profile ? [profile] : [])");
  });

  it("stays out of the footer's social icons, where a map does not belong", async () => {
    const source = await readFile("lib/seo.ts", "utf8");
    const socials = source.slice(
      source.indexOf("export function businessSocialProfiles"),
      source.indexOf("export function businessSocialLinks"),
    );

    expect(socials.length, "the social list moved").toBeGreaterThan(0);
    expect(socials).not.toContain("googleBusiness");
  });
});
