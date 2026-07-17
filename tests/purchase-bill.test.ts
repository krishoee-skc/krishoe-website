import { describe, expect, it } from "vitest";
import { billKindFromLines, billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

describe("bill totals", () => {
  it("adds every line up", () => {
    const totals = billTotals(
      [
        { quantity: 100, rate: 500 }, // 50000
        { quantity: 200, rate: 350 }, // 70000
        { quantity: 50, rate: 1200 }, // 60000
      ],
      { discount: 0, tax: 0 },
    );

    expect(totals.subtotal).toBe(180000);
    expect(totals.total).toBe(180000);
  });

  it("takes the discount off and puts the tax on", () => {
    const totals = billTotals([{ quantity: 100, rate: 500 }], { discount: 5000, tax: 2000 });

    expect(totals.total).toBe(47000); // 50000 - 5000 + 2000
  });

  it("will not let a discount exceed what was charged", () => {
    // A supplier cannot discount more than the bill. A negative total would
    // post the shop a debt the supplier owes them.
    const totals = billTotals([{ quantity: 10, rate: 100 }], { discount: 99999, tax: 0 });

    expect(totals.discount).toBe(1000);
    expect(totals.total).toBe(0);
  });

  it("handles a bill with one line", () => {
    const totals = billTotals([{ quantity: 300, rate: 1050 }], { discount: 0, tax: 0 });

    expect(totals.subtotal).toBe(315000);
  });

  it("handles a bill with no lines", () => {
    expect(billTotals([], { discount: 0, tax: 0 }).total).toBe(0);
  });
});

describe("sharing the bill across its lines", () => {
  it("splits a discount by what each line is worth", () => {
    // 50000 and 150000 of a 200000 bill: a 10000 discount is 2500 / 7500.
    const shares = shareBillAcrossLines(
      [
        { quantity: 100, rate: 500 },
        { quantity: 100, rate: 1500 },
      ],
      { discount: 10000, tax: 0 },
    );

    expect(shares[0].lineTotal).toBe(47500);
    expect(shares[1].lineTotal).toBe(142500);
  });

  it("splits tax the same way", () => {
    const shares = shareBillAcrossLines(
      [
        { quantity: 100, rate: 500 },
        { quantity: 100, rate: 1500 },
      ],
      { discount: 0, tax: 20000 },
    );

    expect(shares[0].lineTotal).toBe(55000); // 50000 + 5000
    expect(shares[1].lineTotal).toBe(165000); // 150000 + 15000
  });

  it("keeps the lines adding up to the bill, to the paisa", () => {
    // 10.00 over three equal lines is 3.333... each. Rounded down that is 9.99
    // and the bill never reconciles with the supplier's copy.
    const lines = [
      { quantity: 1, rate: 100 },
      { quantity: 1, rate: 100 },
      { quantity: 1, rate: 100 },
    ];
    const shares = shareBillAcrossLines(lines, { discount: 10, tax: 0 });
    const totals = billTotals(lines, { discount: 10, tax: 0 });

    expect(sum(shares.map((share) => share.lineTotal))).toBe(totals.total);
    expect(totals.total).toBe(290);
  });

  it("stays exact across an awkward split of many lines", () => {
    // Seven lines, a discount that divides into none of them cleanly.
    const lines = Array.from({ length: 7 }, (_, index) => ({ quantity: 3, rate: 101 + index }));
    const input = { discount: 77.77, tax: 13.13 };
    const shares = shareBillAcrossLines(lines, input);

    expect(sum(shares.map((share) => share.lineTotal))).toBe(billTotals(lines, input).total);
  });

  it("stays exact for a bill of twenty-five lines", () => {
    // The size of bill the owner actually receives.
    const lines = Array.from({ length: 25 }, (_, index) => ({
      quantity: 10 + index,
      rate: 333 + index * 7,
    }));
    const input = { discount: 5000, tax: 1234.56 };
    const shares = shareBillAcrossLines(lines, input);

    expect(shares).toHaveLength(25);
    expect(sum(shares.map((share) => share.lineTotal))).toBe(billTotals(lines, input).total);
  });

  it("gives a single line the whole discount", () => {
    const shares = shareBillAcrossLines([{ quantity: 100, rate: 500 }], { discount: 5000, tax: 0 });

    expect(shares[0].lineTotal).toBe(45000);
  });

  it("keeps the pre-discount value on the line as well", () => {
    // Costing needs what the line cost; the bill view needs what it was worth
    // before the discount. Both are kept rather than one being recomputed.
    const shares = shareBillAcrossLines([{ quantity: 100, rate: 500 }], { discount: 5000, tax: 0 });

    expect(shares[0].lineSubtotal).toBe(50000);
    expect(shares[0].lineTotal).toBe(45000);
  });

  it("never drives the last line negative", () => {
    // The last line takes the remainder, so the rounding of every line before
    // it lands there. A cheap final line on a heavily discounted bill goes to
    // -0.01 without the clamp — costing would then read a negative cost per
    // pair, and the ledger would credit the shop for goods it paid for.
    //
    // These figures came out of a search for the case, not out of the air.
    const shares = shareBillAcrossLines(
      [
        { quantity: 1, rate: 89.26 },
        { quantity: 1, rate: 105.81 },
        { quantity: 1, rate: 98.93 },
        { quantity: 1, rate: 47.58 },
        { quantity: 1, rate: 30.92 },
        { quantity: 1, rate: 183.76 },
        { quantity: 1, rate: 0.01 },
      ],
      { discount: 500.76, tax: 0 },
    );

    expect(shares[6].lineTotal).toBe(0);
    for (const share of shares) {
      expect(share.lineTotal).toBeGreaterThanOrEqual(0);
    }
  });

  it("does not divide by zero when every line is free", () => {
    const shares = shareBillAcrossLines(
      [
        { quantity: 5, rate: 0 },
        { quantity: 5, rate: 0 },
      ],
      { discount: 0, tax: 100 },
    );

    for (const share of shares) {
      expect(Number.isFinite(share.lineTotal)).toBe(true);
    }
    expect(sum(shares.map((share) => share.lineTotal))).toBe(100);
  });

  it("returns nothing for no lines", () => {
    expect(shareBillAcrossLines([], { discount: 10, tax: 5 })).toEqual([]);
  });
});

describe("what kind of bill it turned out to be", () => {
  it("is raw material when every line is", () => {
    expect(billKindFromLines([{ kind: "Raw Material" }, { kind: "Raw Material" }])).toBe(
      "Raw Material",
    );
  });

  it("is trading goods when every line is", () => {
    expect(billKindFromLines([{ kind: "Trading Goods" }])).toBe("Trading Goods");
  });

  it("is mixed when the supplier sold both", () => {
    // The owner confirmed this happens: leather and ready-made chappals on one
    // bill. It is a normal bill, not a mistake to reject.
    expect(billKindFromLines([{ kind: "Raw Material" }, { kind: "Trading Goods" }])).toBe("Mixed");
  });
});
