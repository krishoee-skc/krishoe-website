import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Postgres purchasing integrity query", () => {
  it("does not count valid NULL invoice-level material links as orphans", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts", "postgres-smoke-check.mjs"),
      "utf8",
    );
    const check = source.slice(
      source.indexOf("orphanPurchaseInvoiceRawMaterials"),
      source.indexOf("orphanPurchaseInvoiceSupplierTransactions"),
    );

    expect(check).toContain("invoices.material_id IS NOT NULL");
    expect(check).toContain("materials.id IS NULL");
    expect(check).not.toMatch(/WHERE\s+materials\.id IS NULL/);
  });
});
