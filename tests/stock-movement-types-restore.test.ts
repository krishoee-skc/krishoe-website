import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrationChecksum } from "@/lib/delivery-database";
import { STOCK_MOVEMENT_TYPES, stockMovementTypesMigration, typesMissingFrom } from "@/lib/stock-movement-types-database";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Live, 2026-10-11: the rule on stock_movements still held the seven types of
 * the old snapshot. "Damage Out" was refused, so not one write-off — nor a
 * shelf count that found fewer — could ever be saved.
 */
describe("Damage Out, put back", () => {
  it("is the migration file word for word, and allows every type the code writes", async () => {
    const file = await read(`scripts/migrations/${stockMovementTypesMigration.name}`);
    expect(stockMovementTypesMigration.sql).toBe(file);
    expect(migrationChecksum(stockMovementTypesMigration.sql)).toBe(migrationChecksum(file));
    for (const type of STOCK_MOVEMENT_TYPES) expect(file).toContain(`'${type}'`);
    const rules = await read("lib/stock-rules.ts");
    const union = rules.slice(rules.indexOf("export type StockMovementType"));
    const declared = union.slice(0, union.indexOf(";")).match(/"([A-Za-z ]+)"/g) ?? [];
    for (const type of declared) expect(STOCK_MOVEMENT_TYPES).toContain(type.replace(/"/g, ""));
  });

  it("reads what the live rule leaves out", () => {
    const live =
      "CHECK ((type = ANY (ARRAY['Production In'::text, 'Purchase In'::text, 'Dispatch Out'::text, 'Return In'::text, 'Sale Out'::text, 'Market Sale'::text, 'Adjustment'::text])))";
    expect(typesMissingFrom(live)).toEqual(["Damage Out"]);
  });

  it("changes no row: it only widens the rule", async () => {
    const file = await read(`scripts/migrations/${stockMovementTypesMigration.name}`);
    expect(file).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP TABLE)\b/);
  });

  it("fixes the snapshot a rebuilt database is made from", async () => {
    const schema = await read("docs/schema.sql");
    expect(schema.split("'Market Sale', 'Adjustment', 'Damage Out')").length - 1).toBe(2);
  });

  it("is a button in Settings, and a red dot until pressed", async () => {
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain("<form action={prepareStockMovementTypesAction}");
    const selfCheck = await read("lib/shop-self-check.ts");
    expect(selfCheck).toContain('id: "stock-movement-types"');
  });
});
