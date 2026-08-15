import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { designKey } from "@/lib/design-name";

/**
 * The owner's rule, now everywhere: capitals and spacing are spelling, not
 * identity. Workers and factory items already held it; the shop catalog did
 * not, and "Jeans Shoes" and "jeans shoes" sat side by side as two rows.
 *
 * They are one design to the stock sync, so recording 55 counted pairs against
 * the name would have handed 55 to each of them — 110 pairs in a shop holding
 * 55. That is not a display problem; it is the shop promising stock it does not
 * have.
 */
describe("product name rule", () => {
  it("is the same comparison the stock ledger uses", async () => {
    const source = await readFile("lib/product-store.ts", "utf8");
    // Not a fourth hand-rolled copy: three definitions of "same name" that
    // disagreed by a single space is how one design became two rows.
    expect(source).toContain("const productStockKey = designKey;");
  });

  it("has an index that applies that comparison", async () => {
    const migration = await readFile(
      "scripts/migrations/20260815_product_name_uniqueness.sql",
      "utf8",
    );
    expect(migration).toContain(
      "ON products (lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')))",
    );
  });

  it("refuses a look-alike name at the form, with a message that says why", async () => {
    const source = await readFile("app/admin/actions.ts", "utf8");
    expect(source).toContain("designKey(other.name) === designKey(product.name)");
    expect(source).toContain("capitals and spacing do not count as different");
  });

  it("answers a double-tapped Save the same way", async () => {
    const source = await readFile("app/admin/actions.ts", "utf8");
    expect(source).toContain('isDuplicateNameViolation(error, "products_name_unique_idx")');
  });
});

describe("what counts as the same product name", () => {
  it("folds capitals and spacing together", () => {
    for (const written of ["jeans shoes", "Jeans Shoes", "JEANS SHOES", "  jeans   shoes  "]) {
      expect(designKey(written), written).toBe("jeans shoes");
    }
  });

  it("keeps genuinely different names apart", () => {
    expect(designKey("Doctor Chappal")).not.toBe(designKey("Doctor Chappal moto"));
    expect(designKey("bag open")).not.toBe(designKey("bagopen"));
  });
});
