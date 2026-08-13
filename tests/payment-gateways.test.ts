import { beforeEach, describe, expect, it, vi } from "vitest";

const gateway = vi.hoisted(() => ({
  createEsewaPayment: vi.fn(),
  createKhaltiPayment: vi.fn(),
  verifyEsewaCallback: vi.fn(),
  verifyEsewaReference: vi.fn(),
  verifyKhaltiCallback: vi.fn(),
}));
const submissions = vi.hoisted(() => ({
  getOrderById: vi.fn(),
  orderMatchesCustomer: vi.fn(),
  updateOrderPayment: vi.fn(),
}));
const transactions = vi.hoisted(() => ({
  getByCallbackId: vi.fn(),
  record: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/esewa-gateway", () => ({
  createEsewaPayment: gateway.createEsewaPayment,
  verifyEsewaCallback: gateway.verifyEsewaCallback,
  verifyEsewaReference: gateway.verifyEsewaReference,
}));
vi.mock("@/lib/khalti-gateway", () => ({
  createKhaltiPayment: gateway.createKhaltiPayment,
  verifyKhaltiCallback: gateway.verifyKhaltiCallback,
}));
vi.mock("@/lib/submissions", () => ({
  getOrderById: submissions.getOrderById,
  orderMatchesCustomer: submissions.orderMatchesCustomer,
  updateOrderPayment: submissions.updateOrderPayment,
}));
vi.mock("@/lib/payment-transactions", () => ({
  getPaymentTransactionByCallbackId: transactions.getByCallbackId,
  recordPaymentTransaction: transactions.record,
}));

import {
  getGatewayConfig,
  handleGatewayCallback,
  initiatePayment,
} from "@/lib/payment-gateways";

const customer = {
  id: "customer-1",
  name: "Customer",
  email: "customer@example.com",
  createdAt: "2026-08-01T00:00:00.000Z",
};

const order = {
  id: "KRS-1001",
  name: "Customer",
  total: "Rs. 1,999",
  status: "Contacted",
  paymentStatus: "Unpaid",
  paymentProvider: "manual",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYMENT_MODE = "sandbox";
  process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example";
  process.env.ESEWA_MERCHANT_ID = "EPAYTEST";
  process.env.ESEWA_SECRET_KEY = "test-secret";
  process.env.KHALTI_SECRET_KEY = "test-khalti-secret";
  delete process.env.PAYMENT_PUBLIC_BASE_URL;

  submissions.getOrderById.mockResolvedValue(order);
  submissions.orderMatchesCustomer.mockReturnValue(true);
  submissions.updateOrderPayment.mockImplementation(async (_id, payment) => ({
    ...order,
    paymentStatus: payment.status,
    paymentProvider: payment.provider,
    paymentReference: payment.reference,
  }));
  transactions.record.mockResolvedValue({ id: "PAY-1" });
  transactions.getByCallbackId.mockResolvedValue(null);
  gateway.createEsewaPayment.mockReturnValue({
    formUrl: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    fields: { total_amount: "1999" },
  });
});

describe("payment initiation security", () => {
  it("uses the saved order total and ignores a browser-supplied amount", async () => {
    const result = await initiatePayment({
      provider: "esewa",
      values: { orderId: order.id, amount: "1" },
      requestUrl: "https://shop.example/api/payments/esewa/initiate",
      customer,
    });

    expect(result.status).toBe(200);
    expect(gateway.createEsewaPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1999 }),
    );
    expect(transactions.record).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1999, paymentStatus: "Pending" }),
    );
  });

  it("does not reveal or initiate an order owned by another customer", async () => {
    submissions.orderMatchesCustomer.mockReturnValue(false);

    const result = await initiatePayment({
      provider: "esewa",
      values: { orderId: order.id },
      requestUrl: "https://shop.example/api/payments/esewa/initiate",
      customer,
    });

    expect(result.status).toBe(404);
    expect(gateway.createEsewaPayment).not.toHaveBeenCalled();
  });

  it("blocks a second attempt while the first is pending", async () => {
    submissions.getOrderById.mockResolvedValue({ ...order, paymentStatus: "Pending" });

    const result = await initiatePayment({
      provider: "khalti",
      values: { orderId: order.id },
      requestUrl: "https://shop.example/api/payments/khalti/initiate",
      customer,
    });

    expect(result.status).toBe(409);
    expect(gateway.createKhaltiPayment).not.toHaveBeenCalled();
  });
});

describe("live payment safety", () => {
  it("requires an HTTPS public payment origin in live mode", () => {
    process.env.PAYMENT_MODE = "live";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    expect(getGatewayConfig("esewa").liveReady).toBe(false);

    process.env.PAYMENT_PUBLIC_BASE_URL = "https://krishoe.example";
    expect(getGatewayConfig("esewa").liveReady).toBe(true);
  });

  it("does not downgrade a paid order when a late failed callback arrives", async () => {
    process.env.PAYMENT_MODE = "live";
    process.env.PAYMENT_PUBLIC_BASE_URL = "https://krishoe.example";
    const paidOrder = { ...order, paymentStatus: "Paid" };
    gateway.verifyEsewaCallback.mockResolvedValue({
      ok: true,
      order: paidOrder,
      amount: 1999,
      callbackId: "esewa:reference:failed",
      paymentStatus: "Failed",
      paymentReference: "reference",
      note: "Provider reported a late failure.",
    });

    const result = await handleGatewayCallback({
      provider: "esewa",
      values: { data: "signed" },
      requestUrl: "https://krishoe.example/api/payments/esewa/callback",
    });

    expect(result.status).toBe(200);
    expect(submissions.updateOrderPayment).toHaveBeenCalledWith(
      paidOrder.id,
      expect.objectContaining({ status: "Paid" }),
    );
    expect(transactions.record).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: "Paid" }),
    );
  });
});
