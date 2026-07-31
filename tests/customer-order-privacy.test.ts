import { describe, expect, it } from "vitest";
import { orderMatchesCustomer, type OrderSubmission } from "@/lib/submissions";

function testOrder(overrides: Partial<OrderSubmission> = {}): OrderSubmission {
  return {
    id: "KRS-ORD-TEST",
    createdAt: "2026-07-31T00:00:00.000Z",
    customerUserId: undefined,
    name: "Test Customer",
    email: "customer@example.com",
    phone: "+9779800000000",
    address: "Bharatpur",
    delivery: "Home delivery",
    payment: "Cash on delivery",
    order: "1. Test Shoe",
    items: [],
    total: "Rs. 1,000",
    status: "New",
    paymentStatus: "Unpaid",
    paymentProvider: "cod",
    ...overrides,
  };
}

describe("orderMatchesCustomer", () => {
  it("always allows the account that placed the order while signed in", () => {
    expect(orderMatchesCustomer(testOrder({ customerUserId: "user-1" }), { id: "user-1" })).toBe(true);
  });

  it("does not expose guest order details to an unverified matching email", () => {
    expect(orderMatchesCustomer(testOrder(), { id: "user-1", email: "customer@example.com" })).toBe(false);
  });

  it("allows a verified matching email to claim guest orders", () => {
    expect(
      orderMatchesCustomer(testOrder(), {
        id: "user-1",
        email: "customer@example.com",
        emailVerifiedAt: "2026-07-31T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("requires phone verification before using phone to match private order details", () => {
    expect(orderMatchesCustomer(testOrder(), { id: "user-1", phone: "+9779800000000" })).toBe(false);
    expect(
      orderMatchesCustomer(testOrder(), {
        id: "user-1",
        phone: "+9779800000000",
        phoneVerifiedAt: "2026-07-31T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});
