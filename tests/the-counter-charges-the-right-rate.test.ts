import { describe, expect, it } from "vitest";
import {
  BILL_WALK,
  emptyRow,
  rateForChannel,
  rowIsTouched,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * What the counter charges, and what it counts as a line.
 *
 * Every check on the POS bill reads its source as text — that the walk is in
 * the right order, that the rate call is present. One of them asserts the
 * literal string "rateForChannel(channel, item)" appears in the form, which
 * proves the call is wired up and nothing more: swap the two rates inside the
 * function and that check stays green while every wholesale customer is
 * charged the retail price, or every retail customer the trade price.
 *
 * On a shop where the trade rate is most of the retail one, that is the
 * difference between a sale and a loss, repeated on every bill until somebody
 * notices by hand.
 *
 * So these call the functions.
 */

const item: SellableItem = {
  design: "bag open",
  sku: "KS-0001",
  stock: 58,
  retailRate: 65000,
  wholesaleRate: 48000,
  sizes: "36-41",
};

describe("the rate the counter fills in", () => {
  it("charges the trade rate on a wholesale bill", () => {
    expect(rateForChannel("Wholesale", item)).toBe(48000);
  });

  it("charges the shelf rate at the counter", () => {
    expect(rateForChannel("Retail", item)).toBe(65000);
  });

  it("charges the shelf rate online, not the trade rate", () => {
    // Online is a retail customer buying one pair. Reading it as anything but
    // the shelf price publishes the shop's trade rate to the public.
    expect(rateForChannel("Online", item)).toBe(65000);
  });

  it("falls back to the shelf rate for a channel it does not know", () => {
    // A new channel must never default to the cheaper of the two prices.
    expect(rateForChannel("", item)).toBe(65000);
    expect(rateForChannel("Something New", item)).toBe(65000);
  });

  it("keeps the two rates apart", () => {
    // The one mistake that survives every source-text check: the same number
    // returned for both channels.
    expect(rateForChannel("Wholesale", item)).not.toBe(rateForChannel("Retail", item));
  });
});

describe("a new bill line", () => {
  it("opens empty, so nothing is billed that was not rung up", () => {
    const row = emptyRow(1);
    expect(row.sku).toBe("");
    expect(row.quantity).toBe("");
    expect(row.rate).toBe("");
    expect(rowIsTouched(row)).toBe(false);
  });

  it("counts a scanned item, a typed design, a quantity or a rate", () => {
    expect(rowIsTouched({ ...emptyRow(1), sku: "KS-0001" })).toBe(true);
    expect(rowIsTouched({ ...emptyRow(1), design: "bag open" })).toBe(true);
    expect(rowIsTouched({ ...emptyRow(1), quantity: "2" })).toBe(true);
    expect(rowIsTouched({ ...emptyRow(1), rate: "650" })).toBe(true);
  });

  it("does not count a size run alone as a sale", () => {
    // A size run with no pairs, no price and no design is not a line. Counting
    // it would put an empty row on a customer's bill.
    expect(rowIsTouched({ ...emptyRow(1), sizeRun: "36-41" })).toBe(false);
  });
});

describe("the order Enter walks", () => {
  it("settles the totals before the amount paid", () => {
    // The amount paid is settled against a total that already has the discount
    // and the VAT in it, so those come first.
    const paid = BILL_WALK.indexOf("paidAmount");
    expect(BILL_WALK.indexOf("invoiceDiscount")).toBeLessThan(paid);
    expect(BILL_WALK.indexOf("tax")).toBeLessThan(paid);
  });

  it("leaves the scan box off the walk", () => {
    // At the scan box Enter means "add this item", which is how a scanner
    // works. Putting it on the walk would move the cursor away mid-scan.
    expect(BILL_WALK).not.toContain("scan");
    expect(BILL_WALK).not.toContain("sku");
  });
});
