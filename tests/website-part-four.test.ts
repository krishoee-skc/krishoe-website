import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shopOpenNow } from "@/lib/shop-hours";

const read = (path: string) => readFileSync(path, "utf8");

// Website part 4 namuna, owner 2026-10-24: "ka charai garne".
describe("open now, by Nepal's clock (8 to 6, closed Monday)", () => {
  // Nepal is UTC+5:45. 24 October 2026 is a Saturday.
  it("is open on a Saturday morning", () => {
    expect(shopOpenNow(new Date("2026-10-24T04:15:00Z"))).toMatchObject({ open: true, en: "Open now · until 6 PM" });
  });

  it("is closed before 8 and after 6, and says when it opens", () => {
    expect(shopOpenNow(new Date("2026-10-24T02:14:00Z"))).toMatchObject({ open: false, en: "Closed now · opens 8 AM" });
    expect(shopOpenNow(new Date("2026-10-24T13:15:00Z"))).toMatchObject({ open: false, en: "Closed now · opens 8 AM" });
  });

  it("knows a Sunday evening opens again on Tuesday", () => {
    expect(shopOpenNow(new Date("2026-10-25T13:15:00Z"))).toMatchObject({ open: false, en: "Closed now · opens Tuesday 8 AM" });
  });

  it("is closed all Monday", () => {
    expect(shopOpenNow(new Date("2026-10-26T04:15:00Z"))).toMatchObject({ open: false });
    expect(shopOpenNow(new Date("2026-10-26T04:15:00Z")).en).toContain("Closed today");
  });

  it("reads the hour in Nepal, not in the server's zone", () => {
    // 17:59 in Nepal is 12:14 UTC: still open.
    expect(shopOpenNow(new Date("2026-10-24T12:14:00Z")).open).toBe(true);
    // 18:00 in Nepal: closed.
    expect(shopOpenNow(new Date("2026-10-24T12:15:00Z")).open).toBe(false);
  });
});

describe("the four changes", () => {
  it("1: contact leads with Call, WhatsApp and Directions, and open-now", () => {
    const page = read("app/contact/page.tsx");
    expect(page).toContain("<ShopOpenNow />");
    expect(page).toContain("wa.me/${businessContact.whatsappNumber}");
    expect(page).toContain("href={businessMapsUrl}");
    expect(page.indexOf("<ShopOpenNow />")).toBeLessThan(page.indexOf("Ask about sizing"));
  });

  it("2: the install bar stays off the track-order form", () => {
    expect(read("components/PwaInstallHelp.tsx")).toContain('pathname.startsWith("/track-order")');
  });

  it("3: sign in says it once, and says no account is needed", () => {
    const form = read("components/account/AccountLoginForm.tsx");
    expect(form).not.toContain('text("Customer account"');
    expect(form).toContain("No account needed to order.");
    expect(read("app/account/login/page.tsx")).not.toContain("Your saved checkout starts here.");
  });

  it("4: the footer's contact labels are 13px", () => {
    expect(read("components/Footer.tsx")).not.toContain('className="block truncate text-[11px]"');
  });
});
