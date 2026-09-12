import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pages Google was never told about.
 *
 * Search Console reported 20 indexed and 12 not indexed. Reading the sitemap
 * against the routes that actually exist turned up why two of them were never
 * going to be indexed: /return-policy and /review were not in the sitemap at
 * all, while /privacy and /terms — which nobody searches for — were.
 *
 * That is the wrong way round. "Can I send it back?" is asked before the order
 * rather than after, and customers had already told the owner they could not
 * find where to leave a review. Those are the two of the four that sell.
 *
 * Being absent from a sitemap does not forbid indexing; Google can still find
 * a page by following a link. But it is the difference between telling Google
 * a page exists and hoping it notices, and for a shop that has been live for
 * weeks with nine total clicks, hoping is not a plan.
 *
 * So this test is not a list of two paths. It reads every public page route in
 * app/ and requires each one to be either in the sitemap or on a written list
 * of pages that are deliberately kept out — a cart is personal, a checkout is
 * mid-transaction, an account page is behind a login. Adding a new public page
 * and forgetting the sitemap now fails here rather than quietly going unseen.
 */
const SITEMAP = "app/sitemap.ts";

/**
 * Routes that must stay out of the sitemap, each for a stated reason. A page
 * belongs here only if showing it to a stranger from a search result would be
 * wrong or useless — not merely because it is unfinished.
 */
const DELIBERATELY_PRIVATE: Record<string, string> = {
  "/cart": "personal to one shopper, and empty for everyone else",
  "/checkout": "mid-transaction; arriving here from a search means nothing",
  "/wishlist": "personal to one shopper",
  "/account": "behind a login",
  "/customer": "behind a login",
  "/enter": "a login door, not content",
  "/offline": "the service worker's fallback page, not a destination",
  "/feedback": "reached from an order, not from a search",
};

/** Route groups — app/(shop)/faq is served at /faq. */
function routeOf(file: string) {
  return file
    .replace(/\\/g, "/")
    .replace(/^app/, "")
    .replace(/\/page\.tsx$/, "")
    .replace(/\/\([^)]*\)/g, "");
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Admin and worker screens are private by design and carry noindex.
      if (entry.name === "admin" || entry.name === "worker") continue;
      // Dynamic segments are generated from data, not listed as static routes.
      if (entry.name.startsWith("[")) continue;
      found.push(...(await walk(path)));
    } else if (entry.name === "page.tsx") {
      found.push(path);
    }
  }

  return found;
}

describe("every page a shopper could want is offered to Google", () => {
  it("lists each public route in the sitemap, or says why not", async () => {
    const sitemap = await readFile(SITEMAP, "utf8");
    const routes = (await walk("app"))
      .map(routeOf)
      // The home page is listed as baseUrl itself, with no path.
      .filter((route) => route !== "" && !route.startsWith("/(") && !route.includes("["));

    const missing = routes.filter((route) => {
      const parent = `/${route.split("/")[1]}`;
      if (route in DELIBERATELY_PRIVATE || parent in DELIBERATELY_PRIVATE) return false;
      return !sitemap.includes(`\${baseUrl}${route}\``) && !sitemap.includes(`${route}/`);
    });

    expect(
      missing.join("\n"),
      "a public page is not in the sitemap — add it, or add it to DELIBERATELY_PRIVATE with a reason",
    ).toBe("");
  });

  it("offers the two pages that were found missing", async () => {
    const sitemap = await readFile(SITEMAP, "utf8");

    // Named explicitly because these two are the ones Search Console's count
    // was actually short by, and because they are the two that sell.
    expect(sitemap, "/return-policy").toContain("${baseUrl}/return-policy`");
    expect(sitemap, "/review").toContain("${baseUrl}/review`");
  });

  it("ranks them above the policies nobody searches for", async () => {
    const sitemap = await readFile(SITEMAP, "utf8");

    function priorityOf(path: string) {
      const at = sitemap.indexOf(`\${baseUrl}${path}\``);
      const block = sitemap.slice(at, at + 260);
      return Number(block.match(/priority:\s*([\d.]+)/)?.[1]);
    }

    // /privacy and /terms sit at 0.3. A shopper asking whether they can send
    // a pair back is closer to buying than one reading the terms.
    expect(priorityOf("/return-policy")).toBeGreaterThan(priorityOf("/privacy"));
    expect(priorityOf("/review")).toBeGreaterThan(priorityOf("/terms"));
  });

  it("keeps personal pages out, so a stranger never lands in someone's cart", async () => {
    const sitemap = await readFile(SITEMAP, "utf8");

    for (const [route, why] of Object.entries(DELIBERATELY_PRIVATE)) {
      expect(sitemap, `${route} — ${why}`).not.toContain(`\${baseUrl}${route}\``);
    }
  });
});
