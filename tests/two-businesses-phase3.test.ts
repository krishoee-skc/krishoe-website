import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { twoBusinessMigrations } from "@/lib/two-business";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * The factory and the shop as two businesses, part three (owner, 2026-10-31,
 * choices 1(क) and 2(क), "ka ra kha dubai garau"): a challan carries a made
 * shoe's price and is the factory's sale to the shop; the shop's payments to
 * the factory are kept, and what it owes is shown; a made shoe with no price
 * is asked for one on its line, and listed under To do.
 */
describe("two businesses: the challan's price and the shop's account", () => {
  it("adds one table, the same in the app, the migration file and the schema", () => {
    const migration = twoBusinessMigrations[1];
    expect(migration.name).toBe("20261031_shop_factory_payments.sql");
    expect(migration.sql.replace(/\r\n/g, "\n")).toBe(read("scripts/migrations/20261031_shop_factory_payments.sql"));
    const statements = migration.sql
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("--"))
      .join(" ");
    expect(statements).not.toMatch(/DROP|DELETE|UPDATE /);
    expect(read("docs/schema.sql")).toContain("CREATE TABLE IF NOT EXISTS shop_factory_payments (");
  });

  it("keeps step one on while step two waits for its OK", () => {
    const lib = read("lib/two-business.ts");
    expect(lib).toContain("return stepReady(twoBusinessMigrations[0].name);");
    expect(lib).toContain("return stepReady(twoBusinessMigrations[1].name);");
    expect(read("app/admin/settings/page.tsx")).toContain("const twoBusinessOn = await twoBusinessReady().catch(() => false);");
  });

  it("prices a made shoe on the challan, moves bought goods only, and asks what it cannot tell", () => {
    const action = read("app/admin/stock/actions.ts");
    expect(action).toContain("if (shoe.origin === \"bought\") continue;");
    expect(action).toContain("await setFactoryPrice(shoe.productId, typed, by);");
    expect(action).toContain("item.unitPrice = shoe.price;");
    const form = read("app/admin/stock/WherePairsAre.tsx");
    expect(form).toContain('text("Bought: only moved", "किनेको: सारिएको मात्र")');
    expect(form).toContain('text("No price: Rs.", "मूल्य छैन: Rs.")');
    expect(form).toContain('text("Made or bought?", "बनाएको कि किनेको?")');
  });

  it("counts the sale only for the pairs the shop counted in", () => {
    const account = read("lib/shop-factory-account.ts");
    expect(account).toContain("WHEN t.status = 'Received' AND t.from_location = 'Factory' THEN COALESCE(i.received_pairs, 0) * i.unit_price");
    expect(account).toContain("owed: rupees(bought - returned - paid),");
  });

  it("lets the Owner alone remove a payment, with a reason, and keeps it on file", () => {
    const action = read("app/admin/stock/actions.ts");
    expect(action).toMatch(/removeShopFactoryPaymentAction[\s\S]*?requireAdminPermission\("settings:write"\)/);
    expect(read("lib/shop-factory-account.ts")).toContain("UPDATE shop_factory_payments SET removed_at = now()");
  });

  it("lists made shoes with no price under To do", () => {
    expect(read("app/admin/stock/page.tsx")).toContain('id="made-without-price"');
  });
});
