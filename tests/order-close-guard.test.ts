import { describe, expect, it } from "vitest";
import { closeOrderBlockedReason } from "@/lib/order-pos";
import { orderHoldsStock } from "@/lib/order-stock";
import { orderStatuses, type OrderStatus } from "@/lib/submissions";

describe("closeOrderBlockedReason", () => {
  it("allows closing an order that has a POS invoice", () => {
    expect(closeOrderBlockedReason(true)).toBe("");
  });

  it("blocks closing an order that was never billed", () => {
    // Without an invoice nothing posts the Sale Out movement, so the pairs stay
    // on the books after they have shipped — and the error compounds.
    expect(closeOrderBlockedReason(false)).not.toBe("");
  });

  it("points at the two ways forward", () => {
    const reason = closeOrderBlockedReason(false);
    expect(reason).toMatch(/POS invoice/);
    expect(reason).toMatch(/Cancelled/);
  });
});

describe("order statuses", () => {
  it("can express an abandoned order, not just a finished one", () => {
    expect(orderStatuses).toContain("Cancelled");
    expect(orderStatuses).toContain("Closed");
  });

  it("keeps the statuses the type allows and the list offers in step", () => {
    const fromList: readonly OrderStatus[] = orderStatuses;
    expect([...fromList].sort()).toEqual(["Cancelled", "Closed", "Contacted", "New"]);
  });

  it("holds stock for open orders and releases it for resolved ones", () => {
    // Every status must have a decided answer, so a new one cannot quietly
    // default to holding stock forever.
    expect(orderStatuses.filter((status) => orderHoldsStock(status))).toEqual(["New", "Contacted"]);
    expect(orderStatuses.filter((status) => !orderHoldsStock(status))).toEqual([
      "Closed",
      "Cancelled",
    ]);
  });
});
