import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createEsewaPayment,
  verifyEsewaCallback,
  verifyEsewaReference,
} from "@/lib/esewa-gateway";
import { createKhaltiPayment, verifyKhaltiCallback } from "@/lib/khalti-gateway";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import {
  getPaymentTransactionByCallbackId,
  recordPaymentTransaction,
} from "@/lib/payment-transactions";
import {
  getOrderById,
  orderMatchesCustomer,
  updateOrderPayment,
  type OrderSubmission,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";
import type { SafeUser } from "@/lib/user-store";

export type GatewayProvider = Extract<PaymentProvider, "esewa" | "khalti">;
export type PaymentMode = "manual" | "sandbox" | "live";

type GatewayResult = {
  status: number;
  body: Record<string, unknown>;
};

type VerifiedGatewayPayment = {
  order: OrderSubmission;
  amount: number;
  callbackId: string;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentTransactionId?: string;
  note: string;
};

const gatewayProviders = ["esewa", "khalti"] as const;
const gatewayEnvKeys: Record<GatewayProvider, string[]> = {
  esewa: ["ESEWA_MERCHANT_ID", "ESEWA_SECRET_KEY"],
  khalti: ["KHALTI_SECRET_KEY"],
};

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textValue(values: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(values[key]);
    if (value) return value;
  }
  return "";
}

function publicBaseUrl(requestUrl: string) {
  const configured = envValue("PAYMENT_PUBLIC_BASE_URL") || envValue("NEXT_PUBLIC_SITE_URL");

  try {
    const url = new URL(configured || requestUrl);
    if (getPaymentMode() === "live" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function isGatewayProvider(value: string): value is GatewayProvider {
  return gatewayProviders.includes(value as GatewayProvider);
}

export function getPaymentMode(): PaymentMode {
  const mode = envValue("PAYMENT_MODE").toLowerCase();
  if (mode === "sandbox" || mode === "live") return mode;
  return "manual";
}

export function getGatewayConfig(provider: GatewayProvider, requestUrl = "") {
  const mode = getPaymentMode();
  const requiredEnvKeys = [...gatewayEnvKeys[provider]];

  if (mode === "live" && !publicBaseUrl(requestUrl)) {
    requiredEnvKeys.push("PAYMENT_PUBLIC_BASE_URL");
  }

  const missingEnvKeys = requiredEnvKeys.filter((key) => {
    if (key === "PAYMENT_PUBLIC_BASE_URL") return !publicBaseUrl(requestUrl);
    return !envValue(key);
  });
  const configured = missingEnvKeys.length === 0;

  return {
    provider,
    mode,
    configured,
    requiredEnvKeys,
    missingEnvKeys,
    enabled: mode !== "manual" && configured,
    sandboxReady: mode === "sandbox" && configured,
    liveReady: mode === "live" && configured,
  };
}

export function amountFromOrderTotal(total: string) {
  return parseOrderTotalRupees(total);
}

export function createPaymentReference(provider: GatewayProvider, orderId: string) {
  return `${provider.toUpperCase()}-${orderId}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function safeGatewayStatus(current: PaymentStatus, received: PaymentStatus) {
  if (current === "Refunded") return "Refunded";
  if (current === "Paid" && received !== "Refunded") return "Paid";
  return received;
}

function revalidatePaymentPaths(order: OrderSubmission) {
  revalidatePath("/account");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath(`/order/${order.id}`);

  if (order.paymentLedgerId) {
    revalidatePath(`/admin/operations/ledger/${order.paymentLedgerId}`);
  }
}

export async function initiatePayment({
  provider,
  values,
  requestUrl,
  customer,
}: {
  provider: GatewayProvider;
  values: Record<string, string>;
  requestUrl: string;
  customer: SafeUser;
}): Promise<GatewayResult> {
  const config = getGatewayConfig(provider, requestUrl);

  if (config.mode === "manual") {
    return {
      status: 503,
      body: { ok: false, provider, mode: config.mode, message: "Online payment is not enabled." },
    };
  }

  if (!config.configured) {
    return {
      status: 503,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        missingEnvKeys: config.missingEnvKeys,
        message: `${config.mode === "live" ? "Live" : "Sandbox"} payment configuration is incomplete.`,
      },
    };
  }

  const orderId = textValue(values, ["orderId", "order_id"]);
  const order = orderId ? await getOrderById(orderId) : null;

  if (!order || !orderMatchesCustomer(order, customer)) {
    return {
      status: 404,
      body: { ok: false, provider, message: "Order was not found." },
    };
  }

  if (order.status !== "Contacted") {
    return {
      status: 409,
      body: {
        ok: false,
        provider,
        message:
          order.status === "New"
            ? "The order must be confirmed before online payment."
            : "This order can no longer accept an online payment.",
      },
    };
  }

  if (order.paymentStatus === "Paid" || order.paymentStatus === "Refunded") {
    return {
      status: 409,
      body: { ok: false, provider, message: `This order is already ${order.paymentStatus.toLowerCase()}.` },
    };
  }

  if (order.paymentStatus === "Pending") {
    return {
      status: 409,
      body: {
        ok: false,
        provider,
        message: "A payment attempt is already pending. Check its status before trying again.",
      },
    };
  }

  const amount = amountFromOrderTotal(order.total);
  if (amount <= 0) {
    return {
      status: 400,
      body: { ok: false, provider, message: "The order has no payable amount." },
    };
  }

  const baseUrl = publicBaseUrl(requestUrl);
  const reference = createPaymentReference(provider, order.id);
  const esewaPayment =
    provider === "esewa"
      ? createEsewaPayment({ requestUrl: baseUrl, order, amount, reference })
      : null;
  const khaltiPayment =
    provider === "khalti"
      ? await createKhaltiPayment({ requestUrl: baseUrl, order, amount })
      : null;

  if (khaltiPayment && !khaltiPayment.ok) {
    return {
      status: khaltiPayment.status,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        message: "Khalti payment initiation failed.",
        detail: khaltiPayment.body,
      },
    };
  }

  const paymentReference = khaltiPayment?.pidx || reference;
  const paymentTransactionId = khaltiPayment?.pidx;
  const updatedOrder = await updateOrderPayment(order.id, {
    status: "Pending",
    provider,
    reference: paymentReference,
    transactionId: paymentTransactionId,
  });
  const transaction = await recordPaymentTransaction({
    orderId: updatedOrder.id,
    customerName: updatedOrder.name,
    amount,
    paymentStatus: "Pending",
    paymentProvider: provider,
    paymentReference,
    paymentTransactionId,
    source: "system",
    note: `${provider === "esewa" ? "eSewa" : "Khalti"} ${config.mode} payment initiated; awaiting provider verification.`,
  });

  revalidatePaymentPaths(updatedOrder);

  return {
    status: 200,
    body: {
      ok: true,
      provider,
      mode: config.mode,
      orderId: updatedOrder.id,
      amount,
      reference: paymentReference,
      transactionId: transaction.id,
      checkoutUrl: esewaPayment?.formUrl || khaltiPayment?.paymentUrl || null,
      gatewayPayload: esewaPayment
        ? {
            provider: "esewa",
            method: "POST",
            formUrl: esewaPayment.formUrl,
            fields: esewaPayment.fields,
          }
        : khaltiPayment
          ? {
              provider: "khalti",
              method: "GET",
              paymentUrl: khaltiPayment.paymentUrl,
              pidx: khaltiPayment.pidx,
              expiresAt: khaltiPayment.expiresAt,
              expiresIn: khaltiPayment.expiresIn,
            }
          : null,
      message: `Continue to ${provider === "esewa" ? "eSewa" : "Khalti"} to complete payment.`,
    },
  };
}

async function saveVerifiedPayment(
  provider: GatewayProvider,
  verification: VerifiedGatewayPayment,
): Promise<GatewayResult> {
  const existing = await getPaymentTransactionByCallbackId(verification.callbackId);

  if (existing) {
    return {
      status: 200,
      body: {
        ok: true,
        provider,
        idempotent: true,
        callbackId: verification.callbackId,
        orderId: existing.orderId,
        paymentStatus: existing.paymentStatus,
        message: "Callback was already processed.",
      },
    };
  }

  const paymentStatus = safeGatewayStatus(
    verification.order.paymentStatus,
    verification.paymentStatus,
  );
  const updatedOrder = await updateOrderPayment(verification.order.id, {
    status: paymentStatus,
    provider,
    reference: verification.paymentReference,
    transactionId: verification.paymentTransactionId,
    callbackId: verification.callbackId,
  });
  const transaction = await recordPaymentTransaction({
    orderId: updatedOrder.id,
    customerName: updatedOrder.name,
    amount: verification.amount,
    paymentStatus,
    paymentProvider: provider,
    paymentReference: verification.paymentReference,
    paymentTransactionId: verification.paymentTransactionId,
    paymentCallbackId: verification.callbackId,
    ledgerId: updatedOrder.paymentLedgerId,
    ledgerTransactionId: updatedOrder.paymentLedgerTransactionId,
    source: "gateway",
    note:
      paymentStatus === verification.paymentStatus
        ? verification.note
        : `${verification.note} Existing settled status ${paymentStatus} was preserved.`,
  });

  revalidatePaymentPaths(updatedOrder);

  return {
    status: 200,
    body: {
      ok: true,
      provider,
      idempotent: false,
      callbackId: verification.callbackId,
      orderId: updatedOrder.id,
      paymentStatus,
      transactionId: transaction.id,
    },
  };
}

export async function handleGatewayCallback({
  provider,
  values,
  requestUrl,
}: {
  provider: GatewayProvider;
  values: Record<string, string>;
  requestUrl: string;
}): Promise<GatewayResult> {
  const config = getGatewayConfig(provider, requestUrl);

  if (config.mode === "manual" || !config.configured) {
    return {
      status: 503,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        message: "Gateway callback processing is not configured.",
      },
    };
  }

  const verification =
    provider === "esewa"
      ? await verifyEsewaCallback(values)
      : await verifyKhaltiCallback(values);

  if (!verification.ok) return verification;
  return saveVerifiedPayment(provider, verification);
}

export async function reconcilePayment({
  provider,
  orderId,
  requestUrl,
  customer,
}: {
  provider: GatewayProvider;
  orderId: string;
  requestUrl: string;
  customer: SafeUser;
}): Promise<GatewayResult> {
  const config = getGatewayConfig(provider, requestUrl);
  if (config.mode === "manual" || !config.configured) {
    return {
      status: 503,
      body: { ok: false, provider, message: "Payment status lookup is not configured." },
    };
  }

  const order = await getOrderById(orderId);
  if (!order || !orderMatchesCustomer(order, customer)) {
    return { status: 404, body: { ok: false, provider, message: "Order was not found." } };
  }

  if (
    order.paymentStatus !== "Pending" ||
    order.paymentProvider !== provider ||
    !order.paymentReference
  ) {
    return {
      status: 409,
      body: { ok: false, provider, message: "This order has no matching pending payment." },
    };
  }

  const verification =
    provider === "esewa"
      ? await verifyEsewaReference(order)
      : await verifyKhaltiCallback({ pidx: order.paymentReference });

  if (!verification.ok) return verification;
  return saveVerifiedPayment(provider, verification);
}
