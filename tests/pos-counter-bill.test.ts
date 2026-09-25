import { describe, expect, it } from "vitest";
import {
  addPair,
  belowCost,
  billTotals,
  canAddPair,
  cashOutcome,
  findByCode,
  likelyNotes,
  matchesSearch,
  percentOff,
  setPairs,
  sizeChoices,
  wholesaleSet,
  type CartLine,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * The counter bill, tapped in rather than typed.
 *
 * A shoe, then a size, then how it was paid. Everything the screen decides on
 * the way — which sizes can still be sold, what the bill comes to, what change
 * goes back — is one of these functions, so it is tested here and not
 * discovered at the counter with a customer waiting.
 */

// Counted size-wise: three 40s and one 41, nothing uncounted.
const counted: SellableItem = {
  design: "Runner",
  sku: "KS-0205",
  stock: 4,
  retailRate: 2800,
  wholesaleRate: 2250,
  sizes: "39, 40, 41",
  sizeList: ["39", "40", "41"],
  sizeStock: { "40": 3, "41": 1 },
  untrackedPairs: 0,
};

// Entered as one mixed pile of five: no size is known.
const pile: SellableItem = {
  design: "Loafer",
  sku: "KS-0101",
  stock: 5,
  retailRate: 3200,
  wholesaleRate: 2600,
  sizes: "39, 40, 41",
  sizeList: ["39", "40", "41"],
  sizeStock: {},
  untrackedPairs: 5,
  costPerPair: 2700,
};

// A bag: no sizes at all.
const bag: SellableItem = {
  design: "Shoe bag",
  sku: "KS-0900",
  stock: 2,
  retailRate: 300,
  wholesaleRate: 250,
  sizes: "",
};

describe("which sizes can still be sold", () => {
  it("counts a size-wise shoe size by size", () => {
    const choices = sizeChoices(counted, []);
    expect(choices).toEqual([
      { size: "39", left: 0, sellable: false },
      { size: "40", left: 3, sellable: true },
      { size: "41", left: 1, sellable: true },
    ]);
  });

  it("takes the bill into account", () => {
    const bill = addPair([], counted, "Retail", "41");
    const size41 = sizeChoices(counted, bill).find((choice) => choice.size === "41");
    expect(size41).toEqual({ size: "41", left: 0, sellable: false });
    expect(canAddPair(counted, "41", bill)).toBe(false);
    expect(canAddPair(counted, "40", bill)).toBe(true);
  });

  it("sells every size of a mixed pile until the pile runs out, without claiming a count", () => {
    expect(sizeChoices(pile, []).every((choice) => choice.sellable && choice.left === null)).toBe(true);

    let bill: CartLine[] = [];
    for (let pair = 0; pair < 5; pair += 1) bill = addPair(bill, pile, "Retail", pair % 2 ? "40" : "41");
    expect(sizeChoices(pile, bill).some((choice) => choice.sellable)).toBe(false);
  });

  it("falls back to the pile once a size's own pairs are gone", () => {
    const mixed: SellableItem = { ...counted, untrackedPairs: 2 };
    const bill = addPair([], mixed, "Retail", "41");
    // The one counted 41 is on the bill; more 41s may be in the pile.
    expect(sizeChoices(mixed, bill).find((choice) => choice.size === "41")).toEqual({
      size: "41",
      left: null,
      sellable: true,
    });
  });

  it("sells a shoe with no sizes by its plain stock", () => {
    let bill = addPair([], bag, "Retail", "");
    expect(canAddPair(bag, "", bill)).toBe(true);
    bill = addPair(bill, bag, "Retail", "");
    expect(canAddPair(bag, "", bill)).toBe(false);
  });
});

describe("the lines on the bill", () => {
  it("adds a pair to the same line when the same shoe, size and colour is tapped again", () => {
    let bill = addPair([], counted, "Retail", "40", "Blue");
    bill = addPair(bill, counted, "Retail", "40", "Blue");
    bill = addPair(bill, counted, "Retail", "40", "Black");
    expect(bill.map((line) => [line.size, line.color, line.quantity])).toEqual([
      ["40", "Blue", 2],
      ["40", "Black", 1],
    ]);
  });

  it("takes a line off at zero pairs", () => {
    const bill = addPair([], counted, "Retail", "40");
    expect(setPairs(bill, bill[0].key, 0)).toEqual([]);
    expect(setPairs(bill, bill[0].key, 3)[0].quantity).toBe(3);
  });

  it("makes a wholesale set of one pair in each size still sellable", () => {
    expect(wholesaleSet(counted, [])).toEqual(["40", "41"]);
  });
});

describe("what the bill comes to", () => {
  it("adds the lines, takes the discount, adds the tax", () => {
    let bill = addPair([], counted, "Retail", "40");
    bill = addPair(bill, counted, "Retail", "40");
    bill = addPair(bill, pile, "Retail", "41");
    const totals = billTotals(bill, 300, 0);
    expect(totals).toMatchObject({ pairs: 3, subtotal: 8800, discount: 300, total: 8500 });
    expect(billTotals(bill, 0, 130).total).toBe(8930);
  });

  it("never discounts past the bill", () => {
    const bill = addPair([], bag, "Retail", "");
    expect(billTotals(bill, 5000, 0)).toMatchObject({ discount: 300, total: 0 });
  });

  it("says how much bargaining took off", () => {
    const bill = addPair([], counted, "Retail", "40").map((line) => ({ ...line, rate: 2600 }));
    expect(billTotals(bill, 0, 0)).toMatchObject({ subtotal: 2600, bargained: 200 });
  });

  it("works out a percentage off in whole rupees", () => {
    expect(percentOff(2850, 5)).toBe(143);
    expect(percentOff(2800, 10)).toBe(280);
  });
});

describe("cash at the counter", () => {
  it("takes nothing typed as the exact amount", () => {
    expect(cashOutcome(2600, null)).toEqual({ paid: 2600, change: 0, short: 0 });
  });

  it("gives change and still records only the bill as paid", () => {
    expect(cashOutcome(2600, 3000)).toEqual({ paid: 2600, change: 400, short: 0 });
  });

  it("says what is still owed when the cash is short", () => {
    expect(cashOutcome(2600, 2000)).toEqual({ paid: 2000, change: 0, short: 600 });
  });

  it("offers the notes a customer is likely to hand over", () => {
    expect(likelyNotes(2650)).toEqual([2700, 3000, 5000]);
    // A round bill is not paid with the same round note — that is "exact".
    expect(likelyNotes(2600)).toEqual([3000, 5000]);
    expect(likelyNotes(650)).toEqual([700, 1000, 5000]);
    expect(likelyNotes(6200)).toEqual([6500, 7000]);
    expect(likelyNotes(0)).toEqual([]);
  });
});

describe("a rate below what the pair cost", () => {
  it("is flagged when costing knows the cost", () => {
    expect(belowCost(2600, 2700)).toBe(true);
    expect(belowCost(2700, 2700)).toBe(false);
  });

  it("is never flagged against a cost nobody entered", () => {
    expect(belowCost(100, 0)).toBe(false);
    expect(belowCost(100, undefined)).toBe(false);
  });
});

describe("the search box", () => {
  it("reads two digits as a size the customer asked for", () => {
    expect(matchesSearch(counted, "41", [])).toBe(true);
    expect(matchesSearch(counted, "39", [])).toBe(false);
    expect(matchesSearch(pile, "39", [])).toBe(true);
  });

  it("looks for anything else in the name and the code", () => {
    expect(matchesSearch(counted, "runn", [])).toBe(true);
    expect(matchesSearch(counted, "0205", [])).toBe(true);
    expect(matchesSearch(counted, "loafer", [])).toBe(false);
  });

  it("finds a scanned code, with or without a size on the end", () => {
    const catalog = [counted, pile, bag];
    expect(findByCode(catalog, "KS-0205")).toEqual({ item: counted, size: "" });
    expect(findByCode(catalog, "ks-0205-41")).toEqual({ item: counted, size: "41" });
    expect(findByCode(catalog, "KS-0205 40")).toEqual({ item: counted, size: "40" });
    expect(findByCode(catalog, "nothing")).toBeNull();
  });

  it("never cuts a code that itself ends in two digits", () => {
    const tricky: SellableItem = { ...bag, design: "Polish", sku: "KS-09-41" };
    expect(findByCode([tricky], "KS-09-41")).toEqual({ item: tricky, size: "" });
  });
});
