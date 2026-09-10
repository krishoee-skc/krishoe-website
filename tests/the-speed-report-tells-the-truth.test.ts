import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { pageName } from "@/lib/internal-paths";

/**
 * A speed report that sent the owner looking for a fault that was not there.
 *
 * The home page was listed at 40.7 seconds, in red, as the slowest page in the
 * shop. It is not slow. Ten readings were taken of it that day and nine were
 * between 0.6 and 1.4 seconds; the tenth, at 17:38, sat between a 1.1s and a
 * 1.4s reading of the same page, and its TTFB alone was 31 seconds — thirty-one
 * seconds before the server had sent a single byte. That is one phone on a bad
 * connection, not a page that needs work.
 *
 * Two things in the report turned that into an alarm:
 *
 *  1. It grouped by path AND by the browser's rating, so the home page appeared
 *     twice — once as nine good readings, once as that single poor one. The
 *     second row read as the speed of the page.
 *  2. It ranked and coloured on the average, which one 40-second reading in ten
 *     drags from 1.0s to 5.0s.
 *
 * And the row said only "/", so the owner had to ask which page it was.
 */
const MONITORING = "lib/monitoring.ts";
const DASHBOARD = "components/admin/MonitoringDashboard.tsx";

describe("one row for one page", () => {
  it("groups by the page, not by the browser's verdict", async () => {
    const source = await readFile(MONITORING, "utf8");

    expect(source).toContain("GROUP BY path\n");
    expect(source).not.toContain("GROUP BY path, method");
  });

  it("still says when a page was ever rated poor", async () => {
    const source = await readFile(MONITORING, "utf8");

    // Dropping the rating from the grouping must not drop the rating itself.
    expect(source).toContain("rating_rank");
    expect(source).toContain(`s.rating_rank === 1 ? "poor"`);
  });
});

describe("what the report calls typical", () => {
  it("asks the database for the middle reading", async () => {
    const source = await readFile(MONITORING, "utf8");

    expect(source).toContain("PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration)");
  });

  it("judges the colour on the median, not the average", async () => {
    const dash = await readFile(DASHBOARD, "utf8");
    const row = dash.slice(dash.indexOf("const typical ="), dash.indexOf("const label ="));

    expect(row.length, "the verdict block is missing").toBeGreaterThan(0);
    expect(row).toContain("endpoint.medianTime");
    // The average must not decide the verdict; one bad reading moves it.
    expect(row).not.toContain("endpoint.avgTime <= 2500");
  });

  it("keeps the worst reading visible instead of averaging it away", async () => {
    const source = await readFile(MONITORING, "utf8");
    const dash = await readFile(DASHBOARD, "utf8");

    // A shopper really did wait that long; hiding it would be its own lie.
    expect(source).toContain("MAX(duration)::integer as max_time");
    expect(dash).toContain("endpoint.slowest");
  });

  it("says plainly when the worst reading is a one-off", async () => {
    const dash = await readFile(DASHBOARD, "utf8");

    expect(dash).toContain("const oneOff =");
    expect(dash).toContain("one phone on a slow connection");
  });
});

describe("naming the page", () => {
  it("gives the home page a name, because \"/\" names nothing", () => {
    expect(pageName("/")).toEqual({ en: "Home page", ne: "गृह पृष्ठ" });
  });

  it("names the pages a shopkeeper would ask about", () => {
    expect(pageName("/shop")?.en).toBe("Shop");
    expect(pageName("/checkout")?.en).toBe("Checkout");
    expect(pageName("/review")?.en).toBe("Leave a review");
  });

  it("names a kind of page when the address carries the detail", () => {
    expect(pageName("/product/abc-123")?.ne).toBe("जुत्ताको पाना");
    expect(pageName("/shop/ladies-sandals")?.ne).toBe("एउटा वर्ग");
  });

  it("leaves an unknown address alone rather than guessing", () => {
    // An honest path tells the owner more than an invented label.
    expect(pageName("/some/page/nobody/mapped")).toBeNull();
  });

  it("shows the name in the table, above the address", async () => {
    const dash = await readFile(DASHBOARD, "utf8");

    expect(dash).toContain("pageName(endpoint.path)");
    // The address stays: it is what identifies the page.
    expect(dash).toContain("{endpoint.path}");
  });
});
