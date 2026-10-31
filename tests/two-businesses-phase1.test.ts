import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { factoryPriceOf, twoBusinessMigrations } from "@/lib/two-business";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * The factory and the shop as two businesses, part one (owner, 2026-10-31,
 * "code garau"): one Settings OK adds every column; the factory has its own
 * name, PAN and address; a made shoe has a factory price (blank = wholesale);
 * and the vehicle work, unused, is hidden — not deleted.
 */
describe("two businesses: the ground", () => {
  it("adds columns only, the same in the app, the migration file and the schema", () => {
    const migration = twoBusinessMigrations[0];
    expect(migration.sql.replace(/\r\n/g, "\n")).toBe(read("scripts/migrations/20261031_two_businesses.sql"));
    expect(migration.sql).not.toMatch(/DROP|DELETE|UPDATE /);
    const schema = read("docs/schema.sql");
    for (const column of ["factory_name text", "factory_pan text", "factory_address text", "show_vehicles boolean", "factory_price numeric", "business text NOT NULL DEFAULT 'shop'", "bill_group text", "unit_price numeric"]) {
      expect(schema, column).toContain(column);
    }
    expect(migration.columns).toHaveLength(8);
  });

  it("takes a made shoe's own factory price, else its wholesale price", () => {
    expect(factoryPriceOf(420, 450)).toBe(420);
    expect(factoryPriceOf(0, 600)).toBe(600);
    expect(factoryPriceOf(0, 0)).toBe(0);
  });

  it("asks the Owner once in Settings, and keeps the factory's details there", () => {
    const page = read("app/admin/settings/page.tsx");
    expect(page).toContain('id="two-business-database"');
    expect(page).toContain('{ id: "factory", icon: "🏭", en: "Factory business"');
    expect(page).toContain("<VehiclesSwitch on={vehiclesOn} />");
  });

  it("hides every vehicle part unless switched on, and deletes nothing", () => {
    expect(read("lib/two-business.ts")).toContain("return rows[0]?.on ?? false;");
    expect(read("app/admin/operations/_components/OperationsQuickEntry.tsx")).toContain("{vehicles ? (");
    const overview = read("app/admin/operations/_components/OperationsOverview.tsx");
    expect(overview).toContain('{vehicles ? <ReportLine label={<T en="Dispatch out"');
    expect(overview).toContain('{vehicles ? <ReportLine label={<T en="Market sale"');
    expect(read("app/admin/operations/_components/OperationsRecords.tsx")).toContain('new Set(["collection", "vehicles", "dispatch-items"])');
    expect(read("app/admin/operations/page.tsx")).toContain("const vehicles = await vehiclesShown().catch(() => false);");
  });

  it("shows the factory price only on a made shoe and saves it", () => {
    expect(read("app/admin/products/page.tsx")).toContain("editingProduct && editingMade && (await twoBusinessReady()");
    expect(read("app/admin/actions.ts")).toContain("await setFactoryPrice(product.id, factoryPrice");
  });
});
