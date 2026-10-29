import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productOriginMigrations } from "@/lib/product-origins";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-29: Item / Goods sample — 1, 3, 4 and 5 only. */
describe("the Item / Goods page", () => {
  const list = read("app/admin/ProductsClient.tsx");

  it("1: says on each shoe's line what it still needs, on the phone too", () => {
    expect(list).toContain("function NeedChips(");
    expect(list.match(/<NeedChips need=\{needs\[product\.id\]\} text=\{text\} \/>/g)?.length).toBe(2);
    expect(read("app/admin/products/page.tsx")).toContain("shoeReadiness(product, stockSizesOf(finishedStock, product.name))");
  });

  it("keeps the photo boxes and the Drafts panel as they were", () => {
    expect(list).toContain("would sell better with better photos");
    expect(list).toContain("shoe photo(s) not right");
    expect(read("app/admin/products/page.tsx")).toContain("<DraftsPanel drafts={drafts} />");
  });

  it("3: opens on shoes with pairs, with out of stock and work to do a press away", () => {
    expect(list).toContain('useState<"pairs" | "out" | "todo">("pairs")');
    expect(list).toContain('en: "📦 With pairs"');
    expect(list).toContain('en: "Out of stock"');
    expect(list).toContain('en: "⚠ Work to do"');
  });

  it("4: names a shoe on the website with no pairs, and puts it in Draft only if it still has none", () => {
    expect(list).toContain("const webEmpty = products.filter((product) => isWeb(product) && !(product.stock > 0));");
    const actions = read("app/admin/products/actions.ts");
    expect(actions).toContain("export async function unpublishEmptyAction(id: string)");
    expect(actions).toContain('if (product.stock > 0) {');
    expect(actions).toContain('await setProductStatus(product.id, "Draft");');
  });

  it("5: lets the Owner say made or bought where the stock history is silent", () => {
    const form = read("app/admin/ProductForm.tsx");
    expect(form).toContain('<select name="origin" defaultValue={origin.chosen}');
    expect(form).toContain("{origin?.history ? (");
    expect(read("app/admin/actions.ts")).toContain('if (formData.has("origin")) {');
  });

  it("adds one new table, the same in the app, the migration file and the schema, with an OK in Settings", () => {
    const migration = productOriginMigrations[0];
    expect(migration.table).toBe("product_origins");
    expect(migration.sql.replace(/\r\n/g, "\n")).toBe(read("scripts/migrations/20261029_product_origins.sql"));
    expect(read("docs/schema.sql")).toContain("CREATE TABLE IF NOT EXISTS product_origins (");
    const settings = read("app/admin/settings/page.tsx");
    expect(settings).toContain('id="product-origins-database"');
    expect(settings).toContain("<form action={prepareProductOriginsDatabaseAction}");
  });
});
