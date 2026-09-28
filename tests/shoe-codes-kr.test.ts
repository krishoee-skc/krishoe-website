import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  codeProblem,
  codeTakenBy,
  nextShoeCode,
  sameCode,
  suggestCodes,
  tidyCode,
} from "@/lib/shoe-code";
import { findByCode, type SellableItem } from "@/app/admin/pos/_components/pos-bill-rules";
import { shoesMatching, unknownCodeTyped } from "@/app/admin/purchasing/_components/purchase-invoice-rules";

/**
 * Shoe codes the way the owner chose on 2026-09-28 ("तरिका १"): KR-205 — KR
 * for the shop, the first digit for the group, then the number — typed at the
 * counter as just 205, or 205-38 for size 38.
 */
describe("a KR code answers to its number", () => {
  it("with or without KR, #, dash or capitals", () => {
    for (const typed of ["KR-205", "kr205", "kr 205", "#205", "205", "# 205"]) {
      expect(sameCode("KR-205", typed), typed).toBe(true);
    }
    expect(sameCode("KR-205", "206")).toBe(false);
    expect(sameCode("KR-205", "20")).toBe(false);
    // Old random codes still work as they are.
    expect(sameCode("9D72059B", "#9d72059b")).toBe(true);
  });

  it("is stored tidy", () => {
    expect(tidyCode(" kr205 ")).toBe("KR-205");
    expect(tidyCode("Kr 2100")).toBe("KR-2100");
    expect(tidyCode("9D72059B")).toBe("9D72059B");
  });
});

describe("the next code", () => {
  it("comes from the category's group, after the ones taken", () => {
    expect(nextShoeCode([], "mens-collection")).toBe("KR-101");
    expect(nextShoeCode(["KR-201", "kr202"], "ladies-sandals")).toBe("KR-203");
    expect(nextShoeCode(["KR-301"], "ladies-slippers")).toBe("KR-302");
    expect(nextShoeCode([], "kids-collection")).toBe("KR-401");
    expect(nextShoeCode([], "casual-shoes")).toBe("KR-501");
    // A hand-typed "103" is not handed out again as KR-103.
    expect(nextShoeCode(["KR-101", "KR-102", "103"], "mens-collection")).toBe("KR-104");
  });

  it("goes to four digits when a group passes ninety-nine", () => {
    const full = Array.from({ length: 99 }, (_, index) => `KR-${201 + index}`);
    expect(nextShoeCode(full, "ladies-sandals")).toBe("KR-2100");
  });
});

describe("one code, one shoe", () => {
  const products = [
    { id: "a", sku: "KR-205", name: "magic shoe" },
    { id: "b", sku: "103", name: "bantu hill" },
  ];
  it("finds the other shoe that already answers to a code", () => {
    expect(codeTakenBy(products, "kr205")?.name).toBe("magic shoe");
    expect(codeTakenBy(products, "KR-103")?.name).toBe("bantu hill");
    expect(codeTakenBy(products, "KR-205", "a")).toBeUndefined();
    expect(codeTakenBy(products, "KR-206")).toBeUndefined();
  });

  it("refuses an empty code and one that reads as a size", () => {
    expect(codeProblem("")).toBe("empty");
    expect(codeProblem("40")).toBe("looks-like-size");
    expect(codeProblem("KR-205")).toBe("");
    expect(codeProblem("205")).toBe("");
  });
});

describe("the codes page's suggestions", () => {
  it("keeps a KR code, numbers the rest by group and name", () => {
    const suggested = suggestCodes([
      { id: "1", sku: "9D72059B", name: "magic shoe", categorySlug: "ladies-sandals" },
      { id: "2", sku: "KR-201", name: "zeta sandal", categorySlug: "ladies-sandals" },
      { id: "3", sku: "ABCD1234", name: "bantu hill", categorySlug: "mens-collection" },
      { id: "4", sku: "EFGH5678", name: "Doctor Chappal", categorySlug: "ladies-slippers" },
      { id: "5", sku: "kr201", name: "zz copy", categorySlug: "ladies-sandals" },
    ]);
    expect(suggested.get("2")).toBe("KR-201");
    expect(suggested.get("1")).toBe("KR-202");
    expect(suggested.get("3")).toBe("KR-101");
    expect(suggested.get("4")).toBe("KR-301");
    // A second shoe on the same code gets a new one.
    expect(suggested.get("5")).toBe("KR-203");
  });
});

describe("at the counter", () => {
  const catalog = [
    { design: "magic shoe", sku: "KR-205" },
    { design: "bantu hill", sku: "KR-101" },
  ] as unknown as SellableItem[];

  it("205 finds KR-205, and 205-38 is size 38", () => {
    expect(findByCode(catalog, "205")?.item.design).toBe("magic shoe");
    expect(findByCode(catalog, "205-38")).toMatchObject({ size: "38" });
    expect(findByCode(catalog, "205-38")?.item.design).toBe("magic shoe");
    expect(findByCode(catalog, "#101 40")?.item.design).toBe("bantu hill");
    expect(findByCode(catalog, "kr-205-38")).toMatchObject({ size: "38" });
    expect(findByCode(catalog, "999-38")).toBeNull();
  });
});

describe("on the purchase bill", () => {
  const shoes = [{ name: "magic shoe", stock: 40, codes: ["KR-205"], nameNe: "" }];
  it("#205 finds KR-205, and is not called an unknown code", () => {
    expect(shoesMatching(shoes, "#205").map((shoe) => shoe.name)).toEqual(["magic shoe"]);
    expect(shoesMatching(shoes, "205").map((shoe) => shoe.name)).toEqual(["magic shoe"]);
    expect(unknownCodeTyped(shoes, "#205")).toBe("");
    expect(unknownCodeTyped(shoes, "#206")).toBe("206");
  });
});

describe("where codes are made", () => {
  it("a new draft shoe gets the next KR code, not a random one", async () => {
    const store = await readFile("lib/product-store.ts", "utf8");
    expect(store).not.toContain("sku: id.slice(0, 8).toUpperCase(),");
    expect(store).toContain("sku: nextShoeCode(takenCodes, category.slug),");
  });

  it("saving a product refuses a code another shoe has", async () => {
    const actions = await readFile("app/admin/actions.ts", "utf8");
    expect(actions).toContain("const codeClash = codeTakenBy(allProducts, product.sku, product.id);");
  });

  it("the codes page saves only after a second yes", async () => {
    const form = await readFile("app/admin/products/codes/CodesForm.tsx", "utf8");
    expect(form).toContain("हो, ${changed.length} वटा कोड बदल्ने");
    expect(form).toContain("barcode स्टिकर फेरि छाप्नुहोस्");
  });
});
