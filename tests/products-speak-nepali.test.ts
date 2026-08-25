import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The one thing the language switch could never reach.
 *
 * Every visible string in this shop is a hand-written pair, chosen when the
 * page is built. Every string except the ones that matter most: a shoe's name
 * and its description come out of the database, they change when the owner
 * edits them, and the table held one of each. So a shopper who pressed ने read
 * a fully Nepali shop with "close shoes" and "jeans shoes" sitting in the
 * middle of it.
 *
 * That is what the owner meant by "system le didaina" — the system genuinely
 * did not allow it, and no amount of translating components would have fixed
 * it. It needed a column.
 */
const MIGRATION = "scripts/migrations/20260825_product_nepali_names.sql";

describe("a shoe's own name", () => {
  it("has somewhere to live", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS name_ne");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS description_ne");
  });

  it("is nullable, so a half-translated catalogue is not a broken one", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const schema = await readFile("docs/schema.sql", "utf8");

    // NOT NULL here would have demanded every Nepali name before the first
    // one could be saved.
    expect(sql).not.toContain("NOT NULL");
    expect(schema).toContain("name_ne TEXT,");
  });

  it("survives the round trip through the database", async () => {
    const store = await readFile("lib/product-store.ts", "utf8");

    // A column nothing selects and nothing writes is a column that does
    // nothing. All three lists and the parameter array have to carry it.
    expect(store.split("name_ne").length - 1).toBeGreaterThanOrEqual(4);
    expect(store).toContain("nameNe: row.name_ne ?? undefined");
    expect(store).toContain("cleanedProduct.nameNe ?? null");
  });

  it("treats a blank as absent rather than as an empty name", async () => {
    const store = await readFile("lib/product-store.ts", "utf8");

    // "" is a value, and a value wins over the fallback — which would show a
    // Nepali shopper a nameless shoe.
    expect(store).toContain("product.nameNe?.trim() || undefined");
  });

  it("falls back to the English name rather than showing nothing", async () => {
    const text = await readFile("components/commerce/ProductText.tsx", "utf8");

    expect(text).toContain('language === "ne" && ne?.trim() ? ne : en');
  });

  it("reaches the two screens a shopper actually reads", async () => {
    const card = await readFile("components/ProductCard.tsx", "utf8");
    const page = await readFile("app/product/[id]/page.tsx", "utf8");

    expect(card).toContain("<ProductText en={product.name} ne={product.nameNe} />");
    expect(page).toContain("<ProductText en={product.name} ne={product.nameNe} />");
    expect(page).toContain("ne={product.descriptionNe}");
  });

  it("can be typed in, or the column is furniture", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");
    const actions = await readFile("app/admin/actions.ts", "utf8");

    expect(form).toContain('name="nameNe"');
    expect(form).toContain('name="descriptionNe"');
    // And the form says what happens when it is left empty, so nobody thinks
    // they have to translate the whole catalogue before saving one shoe.
    expect(form).toContain("नलेखे English नाम नै देखिन्छ");
    expect(actions).toContain('textValue(formData, "nameNe")');
  });
});
