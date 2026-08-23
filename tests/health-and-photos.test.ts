import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hasNoPhoto, isSamplePhoto } from "@/lib/product-photo";

const DASHBOARD = "components/admin/MonitoringDashboard.tsx";
const LIB = "lib/monitoring.ts";
const PRODUCTS = "app/admin/ProductsClient.tsx";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * The owner opened the health screen on their own laptop and read
 * "💾 Storage — Not set up". The live shop had a Blob store with four product
 * photos in it, serving them over HTTPS at the time. Storage, Email and SMS are
 * read off environment variables, and those belong to whichever machine renders
 * the page — so the screen was describing the laptop while appearing to
 * describe the shop.
 */
describe("whose health the screen is reporting", () => {
  it("knows which machine it is running on", async () => {
    const lib = await readFile(LIB, "utf8");

    // Vercel sets this on its own servers and nowhere else.
    expect(lib).toContain('return process.env.VERCEL ? "live" : "local"');
    expect(lib).toContain("scope: healthScope(),");
  });

  it("says so on the screen rather than leaving it to be guessed", async () => {
    const dashboard = await readFile(DASHBOARD, "utf8");

    expect(dashboard).toContain('monitoring.health.scope === "local"');
    expect(dashboard).toContain("तपाईंको कम्प्युटरको");
  });

  it("still shows a red service as red", async () => {
    const dashboard = code(await readFile(DASHBOARD, "utf8"));

    // The banner explains the reading; it must not replace it. An outage on the
    // live shop is the one thing this screen exists to show.
    expect(dashboard).toContain('service.status === "up"');
    expect(dashboard).toContain("🔴 Down");
  });
});

/**
 * Three shoes were wearing sample photographs that shipped with the template —
 * a ladies-sandals picture standing in for Bachha Rubber (Kids) — and those
 * three were the only ones with stock. A wrong photo is worse than an empty
 * frame: an empty frame says "no photo yet", a wrong one says "this is the
 * shoe", and the shopper finds out when the parcel arrives.
 */
describe("telling a stand-in photo from a real one", () => {
  it("knows the bundled sample folder", () => {
    expect(isSamplePhoto("/images/products/ladies-sandals.jpg")).toBe(true);
  });

  it("leaves a real photo alone", () => {
    expect(isSamplePhoto("https://scx7x508oyhat5zs.public.blob.vercel-storage.com/a.jpeg")).toBe(
      false,
    );
    expect(isSamplePhoto("/uploads/abc-shoe.jpg")).toBe(false);
    expect(isSamplePhoto("/api/images/IMG-123")).toBe(false);
  });

  it("does not mistake an empty frame for a stand-in", () => {
    expect(isSamplePhoto("")).toBe(false);
    expect(isSamplePhoto(null)).toBe(false);
    expect(hasNoPhoto(null)).toBe(true);
    expect(hasNoPhoto("   ")).toBe(true);
    expect(hasNoPhoto("/uploads/a.jpg")).toBe(false);
  });
});

describe("where the owner is told", () => {
  it("names it beside the shoe", async () => {
    const products = await readFile(PRODUCTS, "utf8");

    expect(products).toContain("नमुना फोटो — असली जुत्ताको होइन");
  });

  it("counts only the shoes a shopper can actually reach", async () => {
    const products = await readFile(PRODUCTS, "utf8");

    // A stand-in on a draft costs nothing. One on a shoe with stock is shown to
    // every shopper who finds it.
    expect(products).toContain("product.stock > 0 && (isSamplePhoto(product.image)");
  });

  it("says how many pairs it is costing", async () => {
    const products = await readFile(PRODUCTS, "utf8");

    expect(products).toContain("जुत्ताको फोटो मिलेको छैन");
    expect(products).toContain("total + product.stock");
  });
});

/**
 * The shop is at Kamalnagar. It had been saying Pulchowk — a different part of
 * Narayangadh — in the structured data Google reads for the map pin, in the
 * footer, and in the launch copy. A wrong address on a shop that takes cash on
 * delivery is not a typo; it is a customer standing on the wrong street.
 */
describe("where the shop actually is", () => {
  it("says Kamalnagar", async () => {
    const seo = await readFile("lib/seo.ts", "utf8");
    const config = await readFile("public/seo-config.json", "utf8");

    expect(seo).toContain('"Kamalnagar, Narayangadh"');
    expect(config).toContain("Kamalnagar, Narayangadh, Bharatpur, Chitwan");
  });

  it("no longer says Pulchowk anywhere it speaks for the shop", async () => {
    const files = [
      "lib/seo.ts",
      "public/seo-config.json",
      "docs/SEO_IMPLEMENTATION.md",
      "docs/SOCIAL_LAUNCH_TONIGHT_NP.md",
    ];

    for (const file of files) {
      expect(await readFile(file, "utf8"), file).not.toContain("Pulchowk");
    }
  });
});

/**
 * The monthly report was reported — by me — as never firing, because
 * monthly-sales carried a "see vercel.json" pointing at an entry that is not
 * there. It fires from the daily cron instead, on the Bikram Sambat month turn,
 * which is the month this shop actually keeps books by.
 */
describe("when the monthly report goes out", () => {
  it("turns over on the Nepali month, not the English one", async () => {
    const daily = await readFile("app/api/cron/daily-sales/route.ts", "utf8");

    expect(daily).toContain("isBikramMonthStart");
    expect(daily).toContain('notifyPeriodSalesSummary("monthly" as const)');
  });

  it("does not send a reader to a schedule that was never written", async () => {
    const monthly = await readFile("app/api/cron/monthly-sales/route.ts", "utf8");
    const vercel = await readFile("vercel.json", "utf8");

    expect(monthly).not.toContain("see vercel.json");
    // If a schedule is ever added, this test is the place that has to change too.
    expect(vercel).not.toContain("monthly-sales");
  });
});

/**
 * The footer link and the `sameAs` Google reads both have to land a shopper on
 * the KRISHOE Page. The address the owner had to hand was a share link —
 * /share/14muPXS1uJt/?mibextid=wwXIfr — which is a per-share token, not an
 * address: it redirects twice before arriving, and hands Google a hop instead
 * of a profile.
 */
describe("the Facebook link", () => {
  it("is the Page, in the form Facebook itself redirects to", async () => {
    const seo = await readFile("lib/seo.ts", "utf8");

    expect(seo).toContain("https://www.facebook.com/people/Krishoe/61593622372780/");
  });

  it("carries no per-share tracking token", async () => {
    const seo = await readFile("lib/seo.ts", "utf8");
    const facebook = seo.slice(seo.indexOf("facebook:"), seo.indexOf("instagram:"));

    // mibextid, rdid and share_url are minted per share and mean nothing to
    // anyone else who follows the link.
    expect(facebook).not.toContain("mibextid");
    expect(facebook).not.toContain("share_url");
    expect(facebook).not.toContain("/share/");
  });
});
