import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Three people open this app, and each was met by somebody else's screen.
 *
 * The owner got a wall of tiles led by pairs made — the factory's question, not
 * the shop's. A salesperson signing in got the same "Owner control room" of
 * numbers they could neither act on nor reach, which is how you teach somebody
 * the app is not for them and send them back to the paper notebook. And a
 * customer, who signs in with one question — where are my shoes — was shown
 * four counting tiles in the shop's own bookkeeping language.
 *
 * Each screen now opens with what that person came for.
 */
describe("who each first screen is written for", () => {
  it("gives the owner the shop's money and staff their own counter", async () => {
    const page = await readFile("app/admin/page.tsx", "utf8");

    // The menu beside this was already filtered by role; the page was not.
    expect(page).toContain('canAdmin(adminAccess.role, "settings:write")');
    expect(page).toContain("<TodaySales");
    expect(page).toContain("<StaffToday");
  });

  it("tells staff where the rest of it went, rather than greying it out", async () => {
    const staff = await readFile("components/admin/StaffToday.tsx", "utf8");

    // A disabled control is an invitation to keep trying. A sentence ends it.
    expect(staff).toContain("मालिकको मात्र");
  });

  it("shows a counter the credit it is giving away", async () => {
    const staff = await readFile("components/admin/StaffToday.tsx", "utf8");

    // Money the shop has not got yet, in its own tile and its own colour — a
    // counter that cannot see it will keep giving it.
    expect(staff).toContain("उधारो बाँकी");
    expect(staff).toContain("text-brand-clay");
  });

  it("answers the customer's actual question first", async () => {
    const account = await readFile("app/account/page.tsx", "utf8");
    const body = account.slice(account.indexOf("<Navbar isLoggedIn />"));

    const order = body.indexOf("<YourOrder");
    const tiles = body.indexOf('<StatCard label="Linked orders"');

    expect(order).toBeGreaterThan(-1);
    expect(order).toBeLessThan(tiles);
  });

  it("uses the words the tracking page already uses, in both languages", async () => {
    const card = await readFile("components/account/YourOrder.tsx", "utf8");

    // Not a second vocabulary for the same three states.
    expect(card).toContain("trackingStage");
    expect(card).toContain("text(stage.en, stage.ne)");
  });

  it("draws no progress bar for an order that was cancelled", async () => {
    const card = await readFile("components/account/YourOrder.tsx", "utf8");

    // A row of steps with none of them lit reads as a delay rather than as a
    // decision somebody already made.
    expect(card).toContain("stage.step > 0");
  });
});
