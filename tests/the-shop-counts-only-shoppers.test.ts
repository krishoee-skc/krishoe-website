import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Analytics must count shoppers, not the shopkeeper.
 *
 * The owner's Google Analytics showed "KRISHOE Factory Management" at 110
 * views, against 133 for the home page. Adding up the admin screens — Factory
 * 110, Admin Login 16, Robots 13, Settings 10 — came to 149 views of the
 * owner's own desk, more than the 148 from the shop itself. Half the numbers
 * were the owner looking at their own shop.
 *
 * That is not a small accounting error. Analytics exists to answer "which
 * shoes do people want", and the Meta pixel fires from the same place — Meta
 * does not merely display what it receives, it learns from it and bids on what
 * it learned, so admin visits teach the ad account to chase people who behave
 * like the shopkeeper, with the shopkeeper's money.
 *
 * The block is already there. StorefrontEnhancements returns null on /admin,
 * /worker, /account and /customer, added 2026-09-08 in 02d0b1c, so nothing has
 * been tracked on those screens since. The 110 is history: the owner's report
 * covered 21 August onward, eighteen days of which predate the fix. It cannot
 * be deleted either — a GA4 data-deletion request removes parameter text, not
 * the view counts ("the event will still be counted in the overall metrics"),
 * so the honest remedy is to read the numbers from 9 September on.
 *
 * What was missing was a guard. The existing boundary test checks that the
 * four path strings appear in the file — and that passes even when the `if`
 * that uses them is deleted outright, which was verified by deleting it. The
 * strings survive as an unused constant while every admin screen goes back to
 * reporting into the live analytics and ad accounts, silently, with no test
 * turning red.
 *
 * So these assertions are about the block doing its job, not about four
 * strings being present somewhere in the text.
 */
const ENHANCEMENTS = "components/StorefrontEnhancements.tsx";
const ANALYTICS = "components/commerce/Analytics.tsx";
const LAYOUT = "app/layout.tsx";

/** Every workspace that belongs to the shop rather than to a shopper. */
const PRIVATE = ["/admin", "/worker", "/account", "/customer"];

describe("the private workspaces are not measured", () => {
  it("names every one of them", async () => {
    const source = await readFile(ENHANCEMENTS, "utf8");
    const list = source.slice(
      source.indexOf("const PRIVATE_APP_PREFIXES"),
      source.indexOf("export default"),
    );

    expect(list.length, "the prefix list moved").toBeGreaterThan(0);

    for (const prefix of PRIVATE) {
      expect(list, prefix).toContain(`"${prefix}"`);
    }
  });

  it("actually returns before rendering anything, rather than just listing them", async () => {
    const source = await readFile(ENHANCEMENTS, "utf8");
    const body = source.slice(source.indexOf("export default function"));

    // This is the assertion the older test was missing. Deleting the `if`
    // outright left the constant in place and the file still contained all
    // four strings, so that test passed while every admin screen went back to
    // reporting into the live analytics and ad accounts.
    const guard = body.indexOf("PRIVATE_APP_PREFIXES.some");
    const firstRender = body.indexOf("<Analytics />");

    expect(guard, "nothing consumes PRIVATE_APP_PREFIXES — the list is decoration").toBeGreaterThan(-1);
    expect(body).toContain("return null");

    // And it has to come first. A guard below the render is not a guard.
    expect(guard, "the guard runs after the tags are rendered").toBeLessThan(firstRender);
  });

  it("reads the path it is judging from the real location", async () => {
    const source = await readFile(ENHANCEMENTS, "utf8");

    // A hardcoded or stale path would make the guard always-true or
    // always-false without changing any of the strings above.
    expect(source).toContain("usePathname");
    expect(source).toContain("pathname?.startsWith(prefix)");
  });
});

describe("what is behind that guard", () => {
  it("keeps all three trackers on the shop side of it", async () => {
    const source = await readFile(ENHANCEMENTS, "utf8");
    const rendered = source.slice(source.indexOf("return null"));

    // If any of these were mounted somewhere else — in the root layout, or in
    // a component outside this file — the guard would not cover it.
    expect(rendered).toContain("<Analytics />");
  });

  it("mounts the trackers in one place only, so one guard is enough", async () => {
    const layout = await readFile(LAYOUT, "utf8");

    expect(layout).toContain("<StorefrontEnhancements />");
    // The root layout must not carry its own copy of the tags.
    expect(layout).not.toContain("<Analytics");
    expect(layout).not.toContain("googletagmanager");
    expect(layout).not.toContain("fbq(");
  });

  it("still sends nothing at all outside production", async () => {
    const ids = await readFile("lib/tracking-ids.ts", "utf8");

    // The second half of the same protection: browsing the shop while building
    // it must not teach the live ad account anything either.
    expect(ids).toContain('process.env.NODE_ENV !== "production"');
    expect(ids).toContain('return { meta: "", ga4: "", tiktok: "" };');
  });

  it("carries the Meta pixel too, which is the one that costs money", async () => {
    const analytics = await readFile(ANALYTICS, "utf8");

    // GA4 being wrong misleads. Meta being wrong spends.
    expect(analytics).toContain('<Script id="meta-pixel"');
    expect(analytics).toContain('<Script id="ga4"');
  });
});
