import { describe, expect, it } from "vitest";
import { catalogStockWarnings } from "@/lib/stock-overview";
import type { Product } from "@/lib/products";
import type { OperationsData } from "@/lib/operations";

function product(partial: Partial<Product>): Product {
  return {
    id: partial.id ?? "p1",
    sku: partial.sku ?? "SKU1",
    name: partial.name ?? "bag open",
    status: partial.status ?? "Active",
    stock: partial.stock ?? 0,
    // The rest is not read by catalogStockWarnings; a loose cast keeps the
    // fixture to the fields under test.
  } as Product;
}

function pool(design: string, stockPairs = 10): OperationsData["finishedStock"][number] {
  return {
    id: Math.random().toString(36).slice(2),
    design,
    channel: "Factory",
    sizeRun: "Mixed",
    stockPairs,
    soldPairs: 0,
    returnedPairs: 0,
  } as OperationsData["finishedStock"][number];
}

describe("catalogStockWarnings — website stock that traces to no pool", () => {
  it("flags an active product with stock but no matching ready-stock pool", () => {
    const warnings = catalogStockWarnings([product({ name: "ghost shoe", stock: 9 })], []);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ productName: "ghost shoe", websiteStock: 9 });
  });

  it("does not flag a product backed by a pool, even across a spelling/case difference", () => {
    const products = [product({ name: "Bag Open", stock: 20 })];
    const warnings = catalogStockWarnings(products, [pool("bag open", 20)]);
    expect(warnings).toHaveLength(0);
  });

  it("ignores a product at zero website stock — it sells nothing, so it misleads nobody", () => {
    const warnings = catalogStockWarnings([product({ name: "T bag open", stock: 0 })], []);
    expect(warnings).toHaveLength(0);
  });

  it("ignores draft products — they are not on sale", () => {
    const warnings = catalogStockWarnings(
      [product({ name: "draft only", stock: 50, status: "Draft" })],
      [],
    );
    expect(warnings).toHaveLength(0);
  });

  it("matches on sku or id too, not only the name", () => {
    const products = [product({ name: "renamed in catalog", sku: "BAGOPEN", stock: 5 })];
    const warnings = catalogStockWarnings(products, [pool("BAGOPEN", 5)]);
    expect(warnings).toHaveLength(0);
  });

  it("lists the worst first, by website stock", () => {
    const warnings = catalogStockWarnings(
      [
        product({ id: "a", name: "small ghost", stock: 3 }),
        product({ id: "b", name: "big ghost", stock: 40 }),
      ],
      [],
    );
    expect(warnings.map((w) => w.productName)).toEqual(["big ghost", "small ghost"]);
  });
});
