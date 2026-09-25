import { describe, expect, it } from "vitest";
import {
  addPair,
  rateForChannel,
  repriceForChannel,
  setRate,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

/**
 * What the counter charges.
 *
 * A check that the rate call is present in the form's source proves the call
 * is wired up and nothing more: swap the two rates inside the function and it
 * stays green while every wholesale customer is charged the retail price, or
 * every retail customer the trade price.
 *
 * On a shop where the trade rate is most of the retail one, that is the
 * difference between a sale and a loss, repeated on every bill until somebody
 * notices by hand.
 *
 * So these call the functions — the one that picks the rate, and the ones
 * that put a shoe on the bill at that rate.
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

describe("a shoe tapped onto the bill", () => {
  it("goes on at the channel's rate", () => {
    expect(addPair([], item, "Wholesale", "38")[0].rate).toBe(48000);
    expect(addPair([], item, "Retail", "38")[0].rate).toBe(65000);
  });

  it("keeps the channel's rate beside a bargained one", () => {
    const bill = setRate(addPair([], item, "Retail", "38"), "bag open|38|", 60000);
    expect(bill[0].rate).toBe(60000);
    expect(bill[0].listRate).toBe(65000);
  });

  it("is re-priced when the bill moves to wholesale", () => {
    // A wholesale bill must not quietly keep retail rates, bargained or not.
    const retail = setRate(addPair([], item, "Retail", "38"), "bag open|38|", 60000);
    const wholesale = repriceForChannel(retail, [item], "Wholesale");
    expect(wholesale[0].rate).toBe(48000);
    expect(wholesale[0].listRate).toBe(48000);
  });

  it("never takes a rate of nothing", () => {
    // Clearing the rate box is not a free pair.
    const bill = addPair([], item, "Retail", "38");
    expect(setRate(bill, bill[0].key, 0)[0].rate).toBe(65000);
    expect(setRate(bill, bill[0].key, Number.NaN)[0].rate).toBe(65000);
  });
});
