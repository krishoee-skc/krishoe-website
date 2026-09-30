import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { counterItemLosses, counterItemProblem } from "@/lib/counter-item-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * "+ New item" from a wholesale bill too (owner, 2026-09-30): the wholesale
 * screen said "Nothing matches" with no way to add the goods. From there the
 * wholesale price must be typed; the retail price and the minimum are optional.
 */
const draft = {
  name: "putali patta flat",
  how: "old" as const,
  sizes: { "36": 6 },
  pilePairs: 0,
  retailPrice: 0,
  wholesalePrice: 320,
  channel: "Wholesale" as const,
  costPerPair: 260,
  lossConfirmed: false,
};

describe("the wholesale bill's own price", () => {
  it("needs the wholesale price, not the retail one", () => {
    expect(counterItemProblem(draft)).toBeNull();
    expect(counterItemProblem({ ...draft, wholesalePrice: 0 })?.ne).toBe("थोक मूल्य लेख्नुहोस्।");
  });

  it("still needs the retail price on a retail bill, the wholesale one optional", () => {
    const retail = { ...draft, channel: "Retail" as const, retailPrice: 450, wholesalePrice: 0 };
    expect(counterItemProblem(retail)).toBeNull();
    expect(counterItemProblem({ ...retail, retailPrice: 0 })).not.toBeNull();
    // An older caller that says nothing of the channel is a retail bill.
    expect(counterItemProblem({ ...retail, channel: undefined, wholesalePrice: undefined })).toBeNull();
  });
});

describe("a loss on either price", () => {
  it("questions a wholesale price below cost", () => {
    const low = { ...draft, wholesalePrice: 240 };
    expect(counterItemLosses(low)).toEqual([{ which: "Wholesale", gap: 20 }]);
    expect(counterItemProblem(low)?.ne).toContain("थोक मूल्यमा एक जोडीमा रु. 20 घाटा");
    expect(counterItemProblem({ ...low, lossConfirmed: true })).toBeNull();
  });

  it("questions an optional price below cost too", () => {
    expect(counterItemLosses({ retailPrice: 450, wholesalePrice: 200, costPerPair: 260 })).toEqual([{ which: "Wholesale", gap: 60 }]);
    expect(counterItemLosses({ retailPrice: 450, wholesalePrice: 0, costPerPair: 260 })).toEqual([]);
    expect(counterItemLosses({ retailPrice: 450, wholesalePrice: 320, costPerPair: 0 })).toEqual([]);
  });
});

describe("the item made", () => {
  it("keeps the wholesale price and minimum, and a retail price even when none was typed", async () => {
    const source = await read("lib/counter-items.ts");
    expect(source).toContain("const retailPrice = input.retailPrice > 0 ? input.retailPrice : wholesalePrice;");
    expect(source).toContain("wholesalePriceValue: Math.round(wholesalePrice * 100),");
    expect(source).toContain("    minWholesaleQty,\n");
    expect(source).toContain("wholesaleRate: wholesalePrice > 0 ? wholesalePrice : retailPrice,");
  });

  it("is put on the bill at its wholesale rate", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain('channel={channel === "Wholesale" ? "Wholesale" : "Retail"}');
    expect(form).toContain("wholesaleRate: created.wholesaleRate,");
  });

  it("asks the wholesale price first on a wholesale bill", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain("{isWholesale ? wholesaleBox : retailBox}");
    expect(sheet).toContain('"थोकको न्यूनतम जोडी (चाहे)"');
  });
});
