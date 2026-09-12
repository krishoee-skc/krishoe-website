import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The brand read "K .." on a laptop.
 *
 * The owner sent a screenshot of the shop open on a wide screen. Beside the
 * KRISHOE crest, where the name should be, was "K .." — and under it the
 * tagline had broken into three stacked lines, "WALK / WITH / AUTHORITY".
 *
 * The navigation is one flex row: brand, links, search box, language toggle,
 * theme, wishlist, cart, account. The brand link carried `shrink`, so when
 * everything else asked for room the brand was the item that gave way, and
 * `truncate` on the name then did what it was told. The one piece of text on
 * the page that must always be legible was the one the layout sacrificed.
 *
 * It shrank rather than the search box because that is what the classes said,
 * not because anyone decided it. The fix is to say the opposite.
 */
const NAV = "components/Navbar.tsx";

describe("the brand in the navigation", () => {
  it("does not give way when the row is crowded", async () => {
    const nav = await readFile(NAV, "utf8");
    const link = nav.slice(nav.indexOf('<Link href="/" className="flex'), nav.indexOf("<PrimaryNav"));

    expect(link.length, "the brand link moved").toBeGreaterThan(0);
    expect(link).toContain("shrink-0");
    // `shrink` and `min-w-0` together are what let it collapse to "K ..".
    expect(link).not.toContain('className="flex min-w-0 shrink items-center');
  });

  it("never truncates the shop's own name", async () => {
    const nav = await readFile(NAV, "utf8");
    const name = nav.slice(nav.indexOf("KRISHOE\n") - 400, nav.indexOf("KRISHOE\n"));

    expect(name.length, "the brand name moved").toBeGreaterThan(0);
    expect(name).toContain("whitespace-nowrap");
    expect(name).not.toContain("block truncate");
  });

  it("keeps the tagline on one line", async () => {
    const nav = await readFile(NAV, "utf8");
    // The second occurrence: the first is the logo's alt text, and slicing
    // back from that caught the crest's classes instead of the tagline's.
    const shown = nav.indexOf("Walk with Authority", nav.indexOf("Walk with Authority") + 1);
    const tagline = nav.slice(shown - 300, shown);

    expect(shown, "the visible tagline moved").toBeGreaterThan(-1);

    // At 0.3em of letter-spacing the line was wider than the column it sat in,
    // so it stacked into three.
    expect(tagline).toContain("whitespace-nowrap");
  });
});

/**
 * A panel that drew a heading over nothing.
 *
 * Every line in Recommendations is conditional, which is right — advice nobody
 * needs is noise. But with the shop healthy that left "💡 Recommendations" with
 * an empty list beneath it, which reads as a screen that failed to load rather
 * than as good news.
 *
 * And the note above the speed table said a dependable ranking needs ten
 * readings without saying why there were fewer. The reason is not a fault: a
 * reading is only made when somebody opens the page, and few people have opened
 * those pages yet. Lowering the threshold was checked and rejected — at 3, 4 or
 * 5 the same single row qualifies, because the readings genuinely are not there.
 */
const DASH = "components/admin/MonitoringDashboard.tsx";

describe("the monitoring screen when all is well", () => {
  it("says nothing needs attention instead of showing an empty list", async () => {
    const dash = await readFile(DASH, "utf8");

    expect(dash).toContain("const hasAdvice =");
    expect(dash).toContain("Nothing needs attention");
  });

  it("works that out from the same conditions the list uses", async () => {
    const dash = await readFile(DASH, "utf8");
    const flag = dash.slice(dash.indexOf("const hasAdvice ="), dash.indexOf("// Grey for"));

    // A mismatch would print "nothing needs attention" above a real warning.
    for (const condition of [
      "errorRate > 1",
      "avgResponseTime > 2500",
      "totalErrors > 50",
      "outside.checks === 0",
      "lastFailureAt",
      'value === "down"',
    ]) {
      expect(flag, condition).toContain(condition);
    }
  });

  it("explains why most rows have too few readings", async () => {
    const dash = await readFile(DASH, "utf8");

    // "Needs at least ten" alone reads as a fault in the shop.
    expect(dash).toContain("few shoppers have opened those pages yet");
    expect(dash).toContain("Nothing is broken");
  });

  it("keeps the threshold where the data says it belongs", async () => {
    const dash = await readFile(DASH, "utf8");

    // Checked against the live readings: at 3, 4 and 5 exactly one row of five
    // qualifies, so loosening it would buy nothing and weaken the guard.
    expect(dash).toContain("const thin = endpoint.count < 5");
  });
});
