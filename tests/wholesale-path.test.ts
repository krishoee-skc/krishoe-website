import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavLinks } from "@/app/admin/nav-links";
import { canAccessAdminPath } from "@/lib/admin-role-permissions";

/**
 * Every product already carried a trade rate and a minimum order quantity, and
 * the POS already sold on a Wholesale channel — all built, none of it reachable
 * from the website. A shopkeeper landing on the site had no way to learn that
 * KRISHOE sells wholesale at all.
 *
 * For a factory this is the larger money: a retail customer buys one pair, a
 * shop buys fifty.
 */
describe("the wholesale page", () => {
  it("does not print trade rates", async () => {
    const page = await readFile("app/wholesale/page.tsx", "utf8");

    // The product page already made this decision and it is the right one:
    // publishing trade rates tells every retail customer what the shop paid.
    // The minimum order is not a secret, so that is shown.
    expect(page).not.toContain("wholesalePriceValue}");
    expect(page).not.toContain("formatPrice(product.wholesalePriceValue");
    expect(page).toContain("minWholesaleQty");
    expect(page).toContain("दर फोनमा भनिन्छ");
  });

  it("only lists designs that actually have a trade rate", async () => {
    const page = await readFile("app/wholesale/page.tsx", "utf8");
    expect(page).toContain("product.wholesalePriceValue > 0");
  });

  it("is findable — footer and sitemap", async () => {
    const footer = await readFile("components/Footer.tsx", "utf8");
    const sitemap = await readFile("app/sitemap.ts", "utf8");

    // The footer links from a data list (href: "/wholesale"), so the quoted path
    // is what proves it is reachable.
    expect(footer).toContain('"/wholesale"');
    expect(sitemap).toContain("/wholesale");
  });
});

describe("an enquiry", () => {
  it("keeps the enquiry even when the email fails", async () => {
    const action = await readFile("app/wholesale/actions.ts", "utf8");

    // Saved is saved. Reporting a stored enquiry as failed would make the shop
    // send it twice.
    const notifyAt = action.indexOf("notify owner of wholesale enquiry");
    const saveAt = action.indexOf("await saveWholesaleEnquiry");
    expect(saveAt).toBeGreaterThan(-1);
    expect(notifyAt).toBeGreaterThan(saveAt);
    expect(action).toContain("reportingErrors(");
  });

  it("is rate limited", async () => {
    const action = await readFile("app/wholesale/actions.ts", "utf8");
    expect(action).toContain('bucket: "wholesale-enquiry"');
  });

  it("reaches the Owner by email", async () => {
    const action = await readFile("app/wholesale/actions.ts", "utf8");
    expect(action).toContain('member.role === "Owner"');
    expect(action).toContain("sendStaffSecurityEmail");
  });
});

describe("the admin list", () => {
  it("puts the phone first, because that is where a deal is settled", async () => {
    const page = await readFile("app/admin/wholesale/page.tsx", "utf8");
    expect(page).toContain("href={`tel:");
    expect(page).toContain("https://wa.me/");
  });

  it("is in the menu and behind a permission", () => {
    const link = adminNavLinks.find((item) => item.href === "/admin/wholesale");
    expect(link?.nepali).toBe("थोकको सोधपुछ");

    expect(canAccessAdminPath("Owner", "/admin/wholesale")).toBe(true);
    expect(canAccessAdminPath("Worker", "/admin/wholesale")).toBe(false);
  });
});
