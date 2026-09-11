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
 * A third was waiting on the owner: the Google Business Profile, the thing that
 * puts a shop in the map box above the ordinary results. It exists now —
 * created, verified, and its duplicate listing removed — and the link is set.
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

describe("the Google Business Profile slot", () => {
  it("never lets an empty or broken link into sameAs", () => {
    const schema = localBusinessJsonLd() as Record<string, unknown>;
    const sameAs = (schema.sameAs ?? []) as string[];

    // A sameAs pointing at nothing is worse than none: it tells Google the shop
    // claims a profile it does not have. This held while the slot was empty and
    // still has to hold now that it is filled.
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

/**
 * The profile, now that it exists.
 *
 * The owner created and verified the Google Business Profile, removed a
 * duplicate listing Google had made alongside it, and sent the link. Two
 * earlier attempts were share.google short links — they resolve to the right
 * shop but are the wrong thing to hardcode, because they expire, and a sameAs
 * that stops resolving tells Google the shop claims a profile it does not have.
 *
 * This one is a maps.app.goo.gl link, and following it lands on
 * "KRISHOE, Kamalnagar, Bharatpur" with a permanent Google place id
 * (0x3994fbf8537757cf:0x40ebb0e47783919e) — checked before it went in.
 */
describe("the profile the owner created", () => {
  it("is named in sameAs, so Google knows the shop and the site are one", () => {
    const schema = localBusinessJsonLd() as Record<string, unknown>;
    const sameAs = (schema.sameAs ?? []) as string[];

    expect(sameAs.some((url) => url.includes("maps.app.goo.gl"))).toBe(true);
  });

  it("is a durable Maps link, not a share.google one", () => {
    // share.google links resolve today and may not next month. Two were sent
    // before this one, and both were turned down for that reason.
    expect(businessContact.googleBusiness).not.toContain("share.google");
    expect(businessContact.googleBusiness).toMatch(/^https:\/\/maps\.app\.goo\.gl\//);
  });

  it("can still be replaced from the environment", async () => {
    const source = await readFile("lib/seo.ts", "utf8");

    // If the profile ever moves, this changes without a deploy.
    expect(source).toContain("NEXT_PUBLIC_GOOGLE_BUSINESS_URL");
  });
});
