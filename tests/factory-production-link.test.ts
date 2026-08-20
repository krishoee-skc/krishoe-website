import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The link between the factory ledger and the costing ledger.
 *
 * Two systems run the workshop. `factory_*` knows who made how many pairs and
 * what they are owed; `production_*` knows what those pairs cost in leather and
 * soles, and holds QC. Neither can answer what a pair actually earns on its
 * own — only a linked item can.
 *
 * The bridge was built: factory_items.production_item_id exists, the dropdown
 * exists, the work-entry code follows it. But nine factory items faced one
 * production item, so eight had nothing to point at, and making each one meant
 * leaving the screen, creating it, coming back and choosing it. After months,
 * zero of nine were linked. The missing piece was never the bridge — it was the
 * step before it.
 */
describe("creating the item to link to", () => {
  it("is offered from the screen where the link is made", async () => {
    const page = await readFile("app/admin/factory/items/page.tsx", "utf8");

    expect(page).toContain("create_production_item: true");
    // Only where it is needed. An item already linked has nothing to create.
    expect(page).toContain("{!item.production_item_id ? (");
  });

  it("copies the factory name instead of asking for one", async () => {
    const route = await readFile("app/api/factory/items/route.ts", "utf8");
    const branch = route.slice(route.indexOf("create_production_item"));

    // Two names for one shoe is how the two ledgers drift apart again, and the
    // drift is what costs — not the typing.
    expect(branch).toContain("SELECT name FROM factory_items");
    expect(branch).toContain("name: source[0].name");
  });

  it("reuses a Production Item that already carries the name", async () => {
    const route = await readFile("app/api/factory/items/route.ts", "utf8");
    const branch = route.slice(route.indexOf("create_production_item"));

    // A duplicate here would split one shoe's costs across two records for
    // good, which is worse than the unlinked state it replaces.
    expect(branch).toContain("lower(btrim(name)) = lower(btrim($1))");
    expect(branch).toContain("existing[0]?.id ??");
  });

  it("still refuses to point two factory items at one production item", async () => {
    const route = await readFile("app/api/factory/items/route.ts", "utf8");

    // Shared costing between two shoes is silently wrong in both directions.
    expect(route).toContain("already linked to another Factory Item");
  });
});

describe("what linking does not do", () => {
  it("leaves stock to Packing/QC, as before", async () => {
    const page = await readFile("app/admin/factory/items/page.tsx", "utf8");

    // A wage entry must never create stock: pairs are counted for pay before
    // anyone has checked them, and counting both would double the shop's goods.
    expect(page).toContain("Linking does not automatically increase stock");
  });
});
