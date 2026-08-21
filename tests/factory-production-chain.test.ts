import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const API = "app/api/factory/items/route.ts";
const RULES = "lib/production-accounting-rules.ts";
const QC_SCREEN = "app/admin/operations/production-accounts/page.tsx";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * The chain that carries a finished pair from the factory floor into the shop:
 *
 *   factory_items  →  production_items  →  products
 *
 * Packing/QC posts stock at the end of it, and refuses an item with no catalog
 * product — "Link the production item to a catalog product first". The
 * Packing/QC form does not even list one. So a Production Item created from the
 * items screen with an empty catalogProductId looked linked on that screen and
 * was a dead end at the only place it mattered: the owner would press the
 * button, read "Master linked", and find nothing to choose when they went to
 * post the pairs they had made.
 */
describe("creating a production item from a factory item", () => {
  it("links it to the catalog product of the same name", async () => {
    const api = code(await readFile(API, "utf8"));

    expect(api).toContain("catalogProductId: catalogMatch[0]?.id ?? \"\"");
  });

  it("matches names the way the rest of the shop does", async () => {
    const api = await readFile(API, "utf8");
    const match = api.slice(api.indexOf("const catalogMatch"));

    // Trimmed, single-spaced, lowercased — the same normalisation stock
    // movements use, because one shoe carries one name across the factory, the
    // costing and the shop.
    expect(match.slice(0, 500)).toContain("regexp_replace(btrim(name)");
    expect(match.slice(0, 500)).toContain("lower(");
    // Doubled in source so Postgres receives a whitespace class, not the
    // letter s.
    const doubled = String.fromCharCode(92, 92) + "s+";
    expect(match.slice(0, 500)).toContain(doubled);
  });

  it("prefers a live product over a draft", async () => {
    const api = await readFile(API, "utf8");
    const match = api.slice(api.indexOf("const catalogMatch"));

    expect(match.slice(0, 500)).toContain("CASE WHEN status = 'Active' THEN 0 ELSE 1 END");
  });

  it("leaves it empty rather than pointing at a guess", async () => {
    const api = code(await readFile(API, "utf8"));

    // A wrong link would post one shoe's pairs into another shoe's stock. The
    // production-accounts screen can set it by hand when no name matches.
    expect(api).toContain('catalogMatch[0]?.id ?? ""');
    expect(api).not.toContain("products LIMIT 1");
  });

  it("never overwrites a link somebody chose by hand", async () => {
    const api = await readFile(API, "utf8");
    const backfill = api.slice(api.indexOf("UPDATE production_items"));

    expect(backfill.slice(0, 300)).toContain(
      "coalesce(btrim(catalog_product_id), '') = ''",
    );
  });
});

/**
 * The reasons this link is load-bearing. If either of these changes, the
 * auto-link above stops being the fix and becomes decoration.
 */
describe("why the catalog link matters", () => {
  it("stock posting refuses an item without one", async () => {
    const rules = await readFile(RULES, "utf8");

    expect(rules).toContain("Link the production item to a catalog product first");
  });

  it("the Packing/QC form does not even offer one", async () => {
    const screen = await readFile(QC_SCREEN, "utf8");

    expect(screen).toContain("item.catalogProductId");
  });
});
