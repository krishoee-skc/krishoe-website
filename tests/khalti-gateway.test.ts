import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const submissions = vi.hoisted(() => ({
  getOrderByPaymentReference: vi.fn(),
}));

vi.mock("@/lib/submissions", () => ({
  getOrderByPaymentReference: submissions.getOrderByPaymentReference,
}));

import { createKhaltiPayment, verifyKhaltiCallback } from "@/lib/khalti-gateway";

const order = {
  id: "KRS-1001",
  total: "Rs. 1,999",
  name: "Test Customer",
  phone: "9800000000",
  email: "customer@example.com",
  paymentReference: "pidx-owner",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYMENT_MODE = "sandbox";
  process.env.KHALTI_SECRET_KEY = "test-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Khalti gateway security", () => {
  it("rejects an incomplete initiation response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ pidx: "pidx-owner" })));

    const result = await createKhaltiPayment({
      requestUrl: "https://shop.example",
      order: order as never,
      amount: 1999,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  it("binds the callback to its stored pidx instead of a supplied order ID", async () => {
    submissions.getOrderByPaymentReference.mockResolvedValue(order);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          pidx: "pidx-owner",
          total_amount: 199900,
          status: "Completed",
          transaction_id: "TX-1",
        }),
      ),
    );

    const result = await verifyKhaltiCallback({
      pidx: "pidx-owner",
      orderId: "VICTIM-ORDER-ID",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.id).toBe("KRS-1001");
    expect(submissions.getOrderByPaymentReference).toHaveBeenCalledWith("pidx-owner");
  });

  it("rejects a lookup response for a different pidx", async () => {
    submissions.getOrderByPaymentReference.mockResolvedValue(order);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          pidx: "different-pidx",
          total_amount: 199900,
          status: "Completed",
          transaction_id: "TX-1",
        }),
      ),
    );

    const result = await verifyKhaltiCallback({ pidx: "pidx-owner" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(String(result.body.message)).toMatch(/reference mismatch/i);
  });
});
