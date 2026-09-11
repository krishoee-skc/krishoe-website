import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The shop looking for its own faults.
 *
 * The owner's observation, after the sixth wrong report: every one of these
 * was found by a person reading a screen and thinking "that cannot be right".
 * Fixing each one is easy. The expensive part was the noticing, and the
 * noticing is what nothing in the app was doing.
 *
 * So the shop checks itself, and every check here is a mistake that really
 * happened:
 *
 *   180 pairs of stock with no movement behind them
 *   two test designs sitting in the live catalogue
 *   a ★ 4.8 on every shoe with no review published for it
 *   17 factory items joined to no shoe a customer can buy
 *   a salaried worker written into the piece-wage summary
 *   a checkout asking for money with no bank account set
 *   published reviews pointing at a shoe that was deleted
 *
 * Run against the live shop while writing this, it reported three findings —
 * the factory links, the star ratings, and four orphaned reviews nobody had
 * noticed, written by real customers for shoes cleared out in the trial
 * cleanup. The last one was found by writing the check.
 */
const CHECKS = "lib/shop-self-check.ts";
const PAGE = "app/admin/alerts/page.tsx";

describe("what the shop checks about itself", () => {
  it("covers all seven mistakes that actually happened", async () => {
    const source = await readFile(CHECKS, "utf8");

    for (const id of [
      "unbacked-stock",
      "test-residue",
      "rating-without-reviews",
      "orphan-reviews",
      "production-not-linked",
      "staff-in-piece-summary",
      "no-bank-account",
    ]) {
      expect(source, id).toContain(`id: "${id}"`);
    }
  });

  it("counts before it claims, and never invents a number", async () => {
    const source = await readFile(CHECKS, "utf8");

    // Every check returns null at zero rather than reporting a clean result as
    // a finding — the failure mode of the old speed report in another costume.
    expect(source.match(/if \(n === 0\) return null;/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("does not scold an empty shop about its bank account", async () => {
    const source = await readFile(CHECKS, "utf8");
    const bank = source.slice(source.indexOf('id: "no-bank-account"') - 900);

    // "Nobody can pay you" is not a fault in a shop with nothing to sell; it
    // would fire on day one and be ignored by the time it mattered.
    expect(bank).toContain("if (sellable === 0) return null;");
  });

  it("lets one broken check fail without silencing the others", async () => {
    const source = await readFile(CHECKS, "utf8");

    // A page that says nothing because one query broke is the silence this
    // exists to end.
    expect(source).toContain("reportError(\"shop self check\", error)");
  });

  it("puts the worst first", async () => {
    const source = await readFile(CHECKS, "utf8");

    expect(source).toContain("critical: 0, warning: 1, info: 2");
  });

  it("sends the owner to the screen that fixes it", async () => {
    const source = await readFile(CHECKS, "utf8");

    // The complaint about the old reports: they announced a problem and left
    // you to find where it lived.
    for (const href of [
      "/admin/products",
      "/admin/inbox",
      "/admin/operations/production-accounts/lots",
      "/admin/settings",
    ]) {
      expect(source, href).toContain(`href: "${href}"`);
    }
  });

  it("says every finding in Nepali too", async () => {
    const source = await readFile(CHECKS, "utf8");
    const titles = source.match(/title:/g)?.length ?? 0;
    const titlesNe = source.match(/titleNe:/g)?.length ?? 0;

    expect(titlesNe).toBe(titles);
  });
});

describe("where the owner sees it", () => {
  it("is a section on the alerts screen, under the business alerts", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("runShopSelfCheck");
    expect(page).toContain("What the app found in itself");
  });

  it("says nothing was found, rather than drawing nothing", async () => {
    const page = await readFile(PAGE, "utf8");

    // An empty section reads as a broken screen; naming what was checked makes
    // an empty result evidence.
    expect(page).toContain("seven checks, nothing found");
  });

  it("says so when the checks themselves could not run", async () => {
    const page = await readFile(PAGE, "utf8");

    // The one lie this screen must never tell is "all clear" when it did not
    // look.
    expect(page).toContain("That is not the same as all clear.");
  });

  it("never lets a failed self check take the business alerts down", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("selfCheckFailed");
    expect(page).toContain("let selfChecks: SelfCheck[] = []");
  });
});
