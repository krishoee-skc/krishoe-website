import { beforeEach, describe, expect, it, vi } from "vitest";

const submissions = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  getOrderByPaymentReference: vi.fn(),
}));

vi.mock("@/lib/submissions", () => ({
  getOrderById: submissions.getOrderById,
  getOrderByPaymentReference: submissions.getOrderByPaymentReference,
}));

import { createEsewaSandboxPayment, verifyEsewaCallback } from "@/lib/esewa-gateway";

function fakeOrder(total: string) {
  return {
    id: "KRS-1001",
    total,
    name: "Test Customer",
    phone: "9800000000",
    paymentReference: "",
  };
}

// Produce a genuinely-signed eSewa `data` payload for the given amount, using
// the gateway's own signer so the signature is valid for the test secret.
function signedData(amount: number, reference: string) {
  const payment = createEsewaSandboxPayment({
    requestUrl: "https://shop.example/checkout",
    order: fakeOrder(`Rs. ${amount.toLocaleString("en-IN")}`) as never,
    amount,
    reference,
  });
  return new URL(payment.successUrl).searchParams.get("data") as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ESEWA_SECRET_KEY = "test-secret-key";
  process.env.ESEWA_MERCHANT_ID = "EPAYTEST";
  delete process.env.ESEWA_VERIFY_WITH_STATUS_CHECK;
});

describe("verifyEsewaCallback", () => {
  it("accepts a correctly-signed callback whose amount matches the order", async () => {
    submissions.getOrderByPaymentReference.mockResolvedValue(fakeOrder("Rs. 1,999"));

    const result = await verifyEsewaCallback({ data: signedData(1999, "ESEWA-KRS-1001-ABCD1234") });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amount).toBe(1999);
      expect(result.paymentStatus).toBe("Paid");
    }
  });

  it("rejects a tampered signature", async () => {
    submissions.getOrderByPaymentReference.mockResolvedValue(fakeOrder("Rs. 1,999"));

    const data = signedData(1999, "ESEWA-KRS-1001-ABCD1234");
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<string, string>;
    decoded.total_amount = "1"; // lower the amount; the signature no longer matches
    const tampered = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");

    const result = await verifyEsewaCallback({ data: tampered });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(String(result.body.message)).toMatch(/signature/i);
    }
  });

  it("rejects a validly-signed underpayment (amount != order total)", async () => {
    // Attacker signs a Rs.1 payment, but the order is actually Rs. 9,999.
    submissions.getOrderByPaymentReference.mockResolvedValue(fakeOrder("Rs. 9,999"));

    const result = await verifyEsewaCallback({ data: signedData(1, "ESEWA-KRS-1001-ABCD1234") });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(String(result.body.message)).toMatch(/amount mismatch/i);
    }
  });
});
