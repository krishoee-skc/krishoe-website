import { beforeEach, describe, expect, it, vi } from "vitest";

const submissions = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  getOrderByPaymentReference: vi.fn(),
}));

vi.mock("@/lib/submissions", () => ({
  getOrderById: submissions.getOrderById,
  getOrderByPaymentReference: submissions.getOrderByPaymentReference,
}));

import { verifyKhaltiCallback } from "@/lib/khalti-gateway";

function fakeOrder(total: string) {
  return {
    id: "KRS-1001",
    total,
    name: "Test Customer",
    phone: "9800000000",
    paymentReference: "",
  };
}

// Khalti amounts are verified from a server-side lookup (in paisa), not trusted
// from the client callback.
function mockLookup(body: Record<string, unknown>) {
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.KHALTI_SECRET_KEY = "test-khalti-key";
  global.fetch = vi.fn();
});

describe("verifyKhaltiCallback", () => {
  it("rejects a callback with no pidx", async () => {
    const result = await verifyKhaltiCallback({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("accepts a completed payment whose looked-up amount matches the order", async () => {
    submissions.getOrderById.mockResolvedValue(fakeOrder("Rs. 1,999"));
    mockLookup({ pidx: "PX1", total_amount: 199900, status: "Completed", transaction_id: "TX1" });

    const result = await verifyKhaltiCallback({ pidx: "PX1", orderId: "KRS-1001" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amount).toBe(1999);
      expect(result.paymentStatus).toBe("Paid");
    }
  });

  it("rejects an underpayment even when Khalti reports Completed", async () => {
    // Order is Rs. 9,999 but only Rs. 1 (100 paisa) was actually paid.
    submissions.getOrderById.mockResolvedValue(fakeOrder("Rs. 9,999"));
    mockLookup({ pidx: "PX1", total_amount: 100, status: "Completed", transaction_id: "TX1" });

    const result = await verifyKhaltiCallback({ pidx: "PX1", orderId: "KRS-1001" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(String(result.body.message)).toMatch(/amount mismatch/i);
    }
  });
});
