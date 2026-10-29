import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shareEvenly, soldFirstExtras } from "@/lib/counter-item-rules";
import { sizeSummary } from "@/lib/bill-lines";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-29: a new shoe sells at the counter with only its total pairs
 * known; its purchase bill, with sizes, says which sizes those pairs went from.
 */
describe("a shoe sold with sizes not known", () => {
  const bill = { "40": 12, "41": 12, "42": 12, "43": 12, "44": 12 };

  it("asks which sizes when the bill has sizes and no answer is given", () => {
    const answer = soldFirstExtras({ billQuantity: 60, billSizes: bill, soldPairs: 24, soldSizes: { Mixed: 24 } });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.en).toContain("24 pairs were sold before this bill with no size");
  });

  it("takes the pairs from the sizes given, and adds the rest by size", () => {
    const answer = soldFirstExtras({
      billQuantity: 60,
      billSizes: bill,
      soldPairs: 24,
      soldSizes: { Mixed: 24 },
      mixedFrom: { "40": 4, "41": 5, "42": 6, "43": 5, "44": 4 },
    });
    expect(answer).toEqual({ ok: true, extras: { "40": 8, "41": 7, "42": 6, "43": 7, "44": 8 }, pairs: 36 });
  });

  it("refuses an answer that does not add up, or takes more of a size than the bill has", () => {
    expect(soldFirstExtras({ billQuantity: 60, billSizes: bill, soldPairs: 24, soldSizes: { Mixed: 24 }, mixedFrom: { "40": 20 } }).ok).toBe(false);
    expect(
      soldFirstExtras({ billQuantity: 60, billSizes: bill, soldPairs: 24, soldSizes: { Mixed: 24 }, mixedFrom: { "40": 13, "41": 11 } }).ok,
    ).toBe(false);
  });

  it("leaves the rest uncounted when the shelf is to be counted later", () => {
    expect(soldFirstExtras({ billQuantity: 60, billSizes: bill, soldPairs: 24, soldSizes: { Mixed: 24 }, mixedLater: true })).toEqual({
      ok: true,
      extras: { Mixed: 36 },
      pairs: 36,
    });
  });

  it("still works as before for pairs sold by size, and for a bill with no sizes", () => {
    expect(soldFirstExtras({ billQuantity: 10, billSizes: { "40": 5, "41": 5 }, soldPairs: 2, soldSizes: { "40": 2 } })).toEqual({
      ok: true,
      extras: { "40": 3, "41": 5 },
      pairs: 8,
    });
    expect(soldFirstExtras({ billQuantity: 30, billSizes: {}, soldPairs: 24, soldSizes: { Mixed: 24 } })).toEqual({
      ok: true,
      extras: { Mixed: 6 },
      pairs: 6,
    });
  });

  it("shares evenly in size order and never past a size's room", () => {
    expect(shareEvenly(24, bill)).toEqual({ "40": 5, "41": 5, "42": 5, "43": 5, "44": 4 });
    expect(shareEvenly(5, { "40": 1, "41": 10 })).toEqual({ "40": 1, "41": 4 });
    expect(shareEvenly(9, { "40": 2, "41": 2 })).toEqual({ "40": 2, "41": 2 });
  });

  it("keeps 'Mixed' off the customer's bill", () => {
    expect(sizeSummary([{ size: "Mixed", pairs: 24 }])).toBe("");
    expect(sizeSummary([{ size: "Mixed", pairs: 2 }, { size: "40", pairs: 1 }])).toBe("40");
  });

  it("opens the new item sheet on 'Sizes not known' and records the pile as Mixed", () => {
    const sheet = read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain('useState<"unknown" | "sizes">("unknown")');
    expect(sheet).toContain('const pilePairs = mode === "unknown" ? Math.max(0, Math.round(Number(total) || 0)) : 0;');
    expect(read("lib/counter-items.ts")).toContain("JSON.stringify(pilePairs > 0 ? { ...sizes, Mixed: pilePairs } : sizes)],");
    expect(read("app/admin/pos/_components/PosBillForm.tsx")).toContain('if (canAddPair(item, "", next)) next = addPair(next, item, channel, "", "");');
  });
});
