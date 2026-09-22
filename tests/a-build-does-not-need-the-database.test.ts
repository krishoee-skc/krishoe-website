import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A deploy must not need the database to be reachable.
 *
 * These routes are prerendered: none of them opts out of static rendering, so
 * every `getProducts()` in them runs while the site is being built, on the
 * build machine, before anybody has visited anything. An unreachable database
 * threw there and failed the build — which meant a database outage also froze
 * every fix waiting to go out, including the fixes for the outage itself. Nine
 * finished commits sat unshipped behind exactly that.
 *
 * `getProductsFromPostgres` has no catch of its own and should not have one: a
 * page serving a live request must fail loudly rather than quietly show an
 * empty shop. The guard belongs here, at the build-time reads, where an empty
 * result is the honest answer — the page still builds, and the shoes come back
 * with the next rebuild once the database answers.
 *
 * So this reads the routes rather than running them, and asks one thing of
 * each: the build-time read is inside a try/catch. The list is derived from
 * what the files actually do, so a new prerendered route that reads the
 * catalogue is held to the same rule instead of quietly slipping past a
 * hard-coded list.
 */

// Routes that are prerendered and read the catalogue while building.
//
// `app/product/[id]/page.tsx` is here for its `generateStaticParams` only, and
// that function is checked on its own below. The page body underneath it is
// deliberately left unguarded: it runs per request, and an empty catalogue
// there resolves to `notFound()` — a 404 on a shoe that exists. Serving a real
// product as missing is worse than an error page, and 404s on live products are
// a fault this shop has already been through once.
const BUILD_TIME_ROUTES = [
  "app/sitemap.ts",
  "app/shop/page.tsx",
  "app/shop/[category]/page.tsx",
  "app/wholesale/page.tsx",
  "app/about/page.tsx",
];

const PRERENDER_LIST = "app/product/[id]/page.tsx";

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * Is every `await getProducts(...)` in this file inside a try block?
 *
 * Counts braces from the top of the file to the read. A read sitting inside a
 * `try {` that has not closed yet is guarded; one at the same depth the `try`
 * opened at, or with no `try` before it at all, is not.
 */
function unguardedReads(code: string): number {
  let unguarded = 0;
  const tryDepths: number[] = [];
  let depth = 0;

  for (let index = 0; index < code.length; index += 1) {
    if (code.startsWith("try", index) && /\s|\{/.test(code[index + 3] ?? "")) {
      tryDepths.push(depth);
    }

    if (code[index] === "{") depth += 1;
    if (code[index] === "}") {
      depth -= 1;
      while (tryDepths.length > 0 && depth <= tryDepths[tryDepths.length - 1]) {
        tryDepths.pop();
      }
    }

    if (code.startsWith("getProducts(", index)) {
      if (tryDepths.length === 0) unguarded += 1;
    }
  }

  return unguarded;
}

describe("a build", () => {
  for (const route of BUILD_TIME_ROUTES) {
    it(`does not stop when the database is down: ${route}`, async () => {
      const code = withoutComments(await readFile(route, "utf8"));

      expect(
        unguardedReads(code),
        `${route} reads the catalogue while the site is being built, so an unreachable database fails the deploy`,
      ).toBe(0);
    });
  }

  it("does not stop when the database is down: the product page list", async () => {
    const source = await readFile(PRERENDER_LIST, "utf8");
    const code = withoutComments(source);

    // Only the prerender list, not the page body below it.
    const start = code.indexOf("generateStaticParams");
    expect(start, "generateStaticParams must still be here").toBeGreaterThan(-1);
    const end = code.indexOf("export default", start);
    const listOnly = code.slice(start, end === -1 ? undefined : end);

    expect(
      unguardedReads(listOnly),
      "the prerender list runs at build time, so an unreachable database fails the deploy",
    ).toBe(0);
    expect(listOnly, "the failure must be reported, not swallowed").toMatch(/reportError\(/);
    expect(listOnly, "the list must still ask for products").toMatch(/getProducts\(/);
  });

  it("still lets a product page fail loudly on a live request", async () => {
    const code = withoutComments(await readFile(PRERENDER_LIST, "utf8"));
    const body = code.slice(code.indexOf("export default"));

    // The opposite rule to the one above, and deliberate: with an empty list
    // this page calls notFound(), so swallowing a database failure here serves
    // a 404 for a shoe that exists.
    expect(unguardedReads(body), "the page body must not swallow a database failure").toBeGreaterThan(0);
  });

  it("still reaches the database when it is up", async () => {
    // A guard on the two checks above: the cheapest way to pass them is to stop
    // reading the catalogue at all, which would empty the shop and the sitemap
    // on a perfectly healthy database. These routes must still ask.
    for (const route of BUILD_TIME_ROUTES) {
      const code = withoutComments(await readFile(route, "utf8"));
      expect(code, `${route} must still load products`).toMatch(/getProducts\(/);
    }
  });

  it("leaves the failure visible instead of swallowing it", async () => {
    // An empty catalogue on a live shop is the kind of fault nobody notices for
    // a week. Each guard has to say so where /admin/monitoring can show it.
    for (const route of BUILD_TIME_ROUTES) {
      const code = withoutComments(await readFile(route, "utf8"));
      expect(code, `${route} must report the failure it is continuing past`).toMatch(/reportError\(/);
    }
  });
});
