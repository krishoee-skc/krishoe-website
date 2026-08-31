import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Which API routes are guarded, and by what.
 *
 * This exists because grepping for `requireAdminPermission` says a dozen routes
 * are wide open, and they are not — the guard for most of them lives in
 * proxy.ts, one file away, matching on a path prefix. I read that grep, believed
 * it, and told the owner the shop had ten unprotected endpoints. Every one of
 * them answered 401 or 403 when actually asked.
 *
 * A scare like that costs more than a bug: it teaches the reader that alarms
 * are noise. So the answer is written down here, checked, and no longer a
 * matter of grepping and guessing.
 */

async function routeFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await routeFiles(path, out);
    else if (entry.name === "route.ts") out.push(path);
  }
  return out;
}

function urlOf(file: string) {
  return "/" + file.replace(/^app\//, "").replace(/\/route\.ts$/, "");
}

/**
 * Routes that answer anyone, deliberately.
 *
 * Each is here for a reason a stranger asking is fine, and each has to keep
 * being fine — which is what the assertions below are for.
 */
const PUBLIC: Record<string, string> = {
  "/api/health": "A deploy check. Says whether the shop is up, nothing about what it holds.",
  "/api/version": "Which build is serving. A tab left open across a deploy compares it.",
  "/api/deployment-info": "The same, plus whether the database answers.",
  "/api/monitoring/vitals": "Where a shopper's browser posts how fast the page felt. They are signed in to nothing.",
  "/api/csp-report": "Where the browser reports a blocked script. It posts without a session by design; only the directive and blocked address are kept.",
  "/api/assistant": "The shop assistant a signed-out shopper asks about products. Rate-limited, and it only ever sees public catalog copy.",
  "/api/images/[id]": "Product photographs. They are on the storefront already.",
  "/api/payments/[provider]/callback": "The payment gateway calling back. It carries its own signature.",
  "/api/webhooks/whatsapp": "WhatsApp calling in. Verified by its own token.",
  "/api/checkout": "Gone — answers 410 and does nothing.",
  "/api/customers/feedback": "Gone — answers 410 and does nothing.",
};

describe("every API route is guarded, or is public on purpose", () => {
  it("has no route that is neither", async () => {
    const proxy = await readFile("proxy.ts", "utf8");
    const prefixes = [...proxy.matchAll(/pathname\.startsWith\("([^"]+)"\)/g)]
      .map((m) => m[1])
      .filter((prefix) => prefix.startsWith("/api"));

    // If proxy.ts stops guarding by prefix, this test has to be rewritten
    // rather than quietly passing on an empty list.
    expect(prefixes.length).toBeGreaterThan(3);

    const unaccounted: string[] = [];
    for (const file of await routeFiles("app/api")) {
      const url = urlOf(file);
      const source = await readFile(file, "utf8");

      const guarded =
        prefixes.some((prefix) => url.startsWith(prefix)) ||
        /requireAdminPermission|requireAdmin\b/.test(source) ||
        /getCurrentCustomer|requireCustomer/.test(source) ||
        /CRON_SECRET/.test(source) ||
        // authorizeFactoryApi is the factory side's guard; the policy file it
        // reads denies anything not explicitly listed.
        /requireStaff|requireWorker|factory-api-policy|authorizeFactoryApi/.test(source) ||
        // A route that delegates to another one inherits that one's guard.
        // daily-sales-backup exists to re-run daily-sales, CRON_SECRET and all.
        /import \{ (GET|POST) as \w+ \} from "@\/app\/api\//.test(source) ||
        // A shared secret compared in constant time. The uptime checker runs on
        // GitHub's machines and has no session to present — it holds a token
        // that writes one row and can read nothing back. timingSafeEqual is
        // required rather than any token check: a plain === leaks the length of
        // the correct prefix to anybody willing to send a few thousand guesses.
        /timingSafeEqual/.test(source);

      if (!guarded && !(url in PUBLIC)) unaccounted.push(url);
    }

    // Compared as a joined string rather than an array: vitest truncates the
    // array in its output, and "expected [ …(3) ] to equal []" does not tell
    // you which three. Naming them is the whole point of the test.
    expect(
      unaccounted.join("\n"),
      "Guard these, or add them to PUBLIC with the reason why a stranger asking is fine",
    ).toBe("");
  });

  it("keeps the public list honest — no entry for a route that no longer exists", async () => {
    const urls = new Set((await routeFiles("app/api")).map(urlOf));

    for (const url of Object.keys(PUBLIC)) {
      expect(urls, `${url} is listed as public but has no route`).toContain(url);
    }
  });

  it("gives a reason for every public route", () => {
    for (const [url, reason] of Object.entries(PUBLIC)) {
      expect(reason.length, url).toBeGreaterThan(20);
    }
  });
});

/**
 * A public endpoint answered with the factory's row counts: how many workers
 * KRISHOE employs, how many designs it makes, how much work has been logged.
 * Anyone could read those without a login, and watch them change week by week.
 *
 * None of it is needed to know whether a deployment is healthy.
 */
describe("what the open endpoints give away", () => {
  it("does not publish the size of the business", async () => {
    const route = await readFile("app/api/deployment-info/route.ts", "utf8");

    expect(route).not.toContain("factory_workers");
    expect(route).not.toContain("factory_items");
    expect(route).not.toContain("factory_daily_work");
    expect(route).not.toContain("COUNT(*)");
  });

  it("still answers whether the database is reachable", async () => {
    const route = await readFile("app/api/deployment-info/route.ts", "utf8");

    // Whether it answers, not what it holds.
    expect(route).toContain('await queryPostgres(STORE, "SELECT 1", [])');
    expect(route).toContain("connected: true");
    expect(route).toContain("connected: false");
  });

  it("keeps /api/health free of business data too", async () => {
    const route = await readFile("app/api/health/route.ts", "utf8");

    expect(route).not.toContain("factory_");
    expect(route).not.toContain("COUNT(*)");
  });
});
