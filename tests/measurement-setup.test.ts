import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavLinks, adminSetupLinks } from "@/app/admin/nav-links";
import { ADMIN_SEARCH_PAGES } from "@/lib/admin-search";

/**
 * The tracking code for Meta, TikTok and Google is written and shipped; the
 * three ids that switch it on are blank, so the shop measures nothing. Until
 * they are set an advertising rupee cannot be told from a wasted one — the
 * highest-value half hour available to the owner, and the one thing here I
 * cannot do for them.
 *
 * So the page says plainly which are on, and gives the steps for the rest.
 */
describe("measurement setup", () => {
  it("reads the same variables the tracking code reads", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");
    const analytics = await readFile("components/commerce/Analytics.tsx", "utf8");

    for (const key of [
      "NEXT_PUBLIC_META_PIXEL_ID",
      "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
      "NEXT_PUBLIC_GA4_ID",
    ]) {
      // A setup page naming a variable the app does not read is worse than no
      // page: the owner would set it and see nothing change.
      expect(page, key).toContain(key);
      expect(analytics, key).toContain(key);
    }
  });

  it("says how blind the shop currently is", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");
    expect(page).toContain("अन्धो");
    expect(page).toContain("खर्च रु ०");
  });

  it("does not print a full id back on screen", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");
    // Not a secret — it ships in the page — but a full one on screen invites
    // pasting it into another shop's settings.
    expect(page).toContain("String(tracker.value).slice(-6)");
  });

  it("says the redeploy step, which is the one people miss", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");
    expect(page).toContain("Redeploy");
  });

  it("opens each destination rather than asking for it to be typed", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");

    // Typing "business.facebook.com/events_manager2" off a screen is a step
    // that fails silently: one wrong character lands on a login page the owner
    // cannot tell apart from the right one.
    for (const url of [
      "https://business.facebook.com/events_manager2",
      "https://ads.tiktok.com/i18n/events_manager",
      "https://analytics.google.com",
      // Straight to the screen the ids are pasted into. The account slug came
      // from the owner; guessing one would have landed on another account.
      "https://vercel.com/krishoee-5610s-projects/krishoe-website/settings/environment-variables",
    ]) {
      expect(page, url).toContain(url);
    }
    expect(page).toContain('rel="noreferrer"');
  });

  it("lists only the keys still missing", async () => {
    const page = await readFile("app/admin/measurement/page.tsx", "utf8");
    // Printing a key that is already live invites pasting it a second time, and
    // a duplicate there overwrites a working value with the clipboard.
    expect(page).toContain("(missing.length > 0 ? missing : trackers).map");
  });

  it("is Owner-only, and reachable without living in the daily menu", async () => {
    const permissions = await readFile("lib/admin-role-permissions.ts", "utf8");
    expect(permissions).toContain('["/admin/measurement", "settings:write"]');

    // This is opened once, when the pixel ids are pasted in, and then not
    // again. It used to sit in the main menu beside Orders and Factory Entry,
    // which are opened fifty times a day — the owner asked for it to stop
    // being in the way. It is on the Settings screen and in Search now, so it
    // is still two taps from anywhere; what changed is that it is no longer
    // read past on every other trip.
    expect(adminNavLinks.map((item) => item.href)).not.toContain("/admin/measurement");

    const link = adminSetupLinks.find((item) => item.href === "/admin/measurement");
    expect(link?.nepali).toBe("मापन सेटअप");
    expect(ADMIN_SEARCH_PAGES.map((page) => page.href)).toContain("/admin/measurement");
  });
});

describe("the legacy checkout module", () => {
  it("is gone, along with the route that called it", async () => {
    // It queried promo_codes, shipping_methods, checkout_funnel_analytics and
    // two order columns — none of which exist in this database — so its one
    // live path was a guaranteed 500.
    await expect(readFile("lib/checkout.ts", "utf8")).rejects.toThrow();

    const route = await readFile("app/api/checkout/route.ts", "utf8");
    expect(route).not.toContain("@/lib/checkout");
    expect(route).toContain("410");
  });
});
