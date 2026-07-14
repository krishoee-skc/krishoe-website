import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createEsewaSandboxPayment,
  verifyEsewaCallback,
} from "@/lib/esewa-gateway";
import {
  createKhaltiSandboxPayment,
  verifyKhaltiCallback,
} from "@/lib/khalti-gateway";
import {
  getPaymentTransactionByCallbackId,
  recordPaymentTransaction,
} from "@/lib/payment-transactions";
import {
  getOrderById,
  updateOrderPayment,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";

export type GatewayProvider = Extract<PaymentProvider, "esewa" | "khalti">;
export type PaymentMode = "manual" | "sandbox" | "live";

type GatewayResult = {
  status: number;
  body: Record<string, unknown>;
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

function cleanNumber(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function textValue(values: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(values[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function numberValue(values: Record<string, string>, keys: string[]) {
  return cleanNumber(textValue(values, keys));
}

export function isGatewayProvider(value: string): value is GatewayProvider {
  return gatewayProviders.includes(value as GatewayProvider);
}

export function getPaymentMode(): PaymentMode {
  const mode = envValue("PAYMENT_MODE").toLowerCase();

  if (mode === "sandbox" || mode === "live") {
    return mode;
  }

  return "manual";
}

export function getGatewayConfig(provider: GatewayProvider) {
  const mode = getPaymentMode();
  const requiredEnvKeys = gatewayEnvKeys[provider];
  const missingEnvKeys = requiredEnvKeys.filter((key) => !envValue(key));
  const configured = missingEnvKeys.length === 0;

  return {
    provider,
    mode,
    configured,
    requiredEnvKeys,
    missingEnvKeys,
    sandboxReady: mode === "sandbox" && configured,
    liveReady: false,
    checkoutUrl: envValue(`${provider.toUpperCase()}_CHECKOUT_URL`),
  };
}

export function amountFromOrderTotal(total: string) {
  return cleanNumber(total.replace(/[^\d.]/g, ""));
}

export function createPaymentReference(provider: GatewayProvider, orderId: string) {
  return `${provider.toUpperCase()}-${orderId}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function hashPayload(values: Record<string, string>) {
  return createHash("sha256")
    .update(JSON.stringify(Object.entries(values).sort(([left], [right]) => left.localeCompare(right))))
    .digest("hex")
    .slice(0, 24);
}

function callbackStatus(values: Record<string, string>): PaymentStatus {
  const status = textValue(values, ["status", "state", "paymentStatus", "payment_status"]).toLowerCase();

  if (["success", "successful", "complete", "completed", "paid"].includes(status)) {
    return "Paid";
  }

  if (["failed", "failure", "error", "cancelled", "canceled", "expired"].includes(status)) {
    return "Failed";
  }

  if (["refunded", "refund"].includes(status)) {
    return "Refunded";
  }

  return "Pending";
}

function callbackIdFor(provider: GatewayProvider, values: Record<string, string>) {
  const explicitCallbackId = textValue(values, [
    "callbackId",
    "callback_id",
    "pidx",
    "refId",
    "ref_id",
    "transaction_uuid",
  ]);

  if (explicitCallbackId) {
    return `${provider}:${explicitCallbackId}`;
  }

  const orderId = textValue(values, ["orderId", "order_id", "purchase_order_id", "transaction_uuid"]);
  const transactionId = textValue(values, ["transactionId", "transaction_id", "idx", "refId", "ref_id"]);

  return `${provider}:${orderId || "unknown"}:${transactionId || hashPayload(values)}`;
}

function successUrl(requestUrl: string, provider: GatewayProvider, orderId: string, reference: string, amount: number) {
  const url = new URL(`/api/payments/${provider}/callback`, requestUrl);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("status", "success");
  url.searchParams.set("reference", reference);
  url.searchParams.set("amount", String(amount));
  return url.toString();
}

function failureUrl(requestUrl: string, provider: GatewayProvider, orderId: string, reference: string, amount: number) {
  const url = new URL(`/api/payments/${provider}/callback`, requestUrl);
  url.searchParams.set("orderId", orderId);
  url.searchParams.set("status", "failed");
  url.searchParams.set("reference", reference);
  url.searchParams.set("amount", String(amount));
  return url.toString();
}

export async function initiateSandboxPayment({
  provider,
  values,
  requestUrl,
}: {
  provider: GatewayProvider;
  values: Record<string, string>;
  requestUrl: string;
}): Promise<GatewayResult> {
  const config = getGatewayConfig(provider);

  if (config.mode !== "sandbox") {
    return {
      status: 503,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        message: "Payment initiation is disabled until PAYMENT_MODE=sandbox is set.",
      },
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
        message: "Sandbox payment keys are missing.",
      },
    };
  }

  const orderId = textValue(values, ["orderId", "order_id"]);
  const order = orderId ? await getOrderById(orderId) : null;

  if (!order) {
    return {
      status: 404,
      body: { ok: false, provider, message: "Order was not found." },
    };
  }

  const amount = numberValue(values, ["amount"]) || amountFromOrderTotal(order.total);

  if (amount <= 0) {
    return {
      status: 400,
      body: { ok: false, provider, message: "A positive amount is required." },
    };
  }

  const reference = textValue(values, ["reference", "paymentReference"]) || createPaymentReference(provider, order.id);
  const esewaPayment =
    provider === "esewa"
      ? createEsewaSandboxPayment({
          requestUrl,
          order,
          amount,
          reference,
        })
      : null;
  const khaltiPayment =
    provider === "khalti"
      ? await createKhaltiSandboxPayment({
          requestUrl,
          order,
          amount,
        })
      : null;

  if (khaltiPayment && !khaltiPayment.ok) {
    return {
      status: khaltiPayment.status,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        message: "Khalti sandbox payment initiation failed.",
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
    note:
      provider === "khalti"
        ? "Khalti sandbox payment initiated. Awaiting callback and lookup verification."
        : `Sandbox ${provider} payment initiated. Server-side provider adapter is not live yet.`,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/order/${updatedOrder.id}`);

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
      checkoutUrl: esewaPayment?.formUrl || khaltiPayment?.paymentUrl || config.checkoutUrl || null,
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
      sandboxCallback: {
        successUrl:
          esewaPayment?.successUrl ??
          successUrl(requestUrl, provider, updatedOrder.id, reference, amount),
        failureUrl:
          esewaPayment?.failureUrl ??
          failureUrl(requestUrl, provider, updatedOrder.id, reference, amount),
      },
      message: "Sandbox payment intent recorded. Wire the provider adapter before redirecting live customers.",
    },
  };
}

export async function handleGatewayCallback({
  provider,
  values,
}: {
  provider: GatewayProvider;
  values: Record<string, string>;
}): Promise<GatewayResult> {
  const config = getGatewayConfig(provider);

  if (config.mode !== "sandbox") {
    return {
      status: 503,
      body: {
        ok: false,
        provider,
        mode: config.mode,
        message: "Gateway callbacks are disabled outside sandbox mode. Live mode requires server-side verification adapters first.",
      },
    };
  }

  if (provider === "esewa") {
    const verification = await verifyEsewaCallback(values);

    if (!verification.ok) {
      return verification;
    }

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

    const updatedOrder = await updateOrderPayment(verification.order.id, {
      status: verification.paymentStatus,
      provider,
      reference: verification.paymentReference,
      transactionId: verification.paymentTransactionId,
      callbackId: verification.callbackId,
    });

    const transaction = await recordPaymentTransaction({
      orderId: updatedOrder.id,
      customerName: updatedOrder.name,
      amount: verification.amount,
      paymentStatus: verification.paymentStatus,
      paymentProvider: provider,
      paymentReference: verification.paymentReference,
      paymentTransactionId: verification.paymentTransactionId,
      paymentCallbackId: verification.callbackId,
      ledgerId: updatedOrder.paymentLedgerId,
      ledgerTransactionId: updatedOrder.paymentLedgerTransactionId,
      source: "gateway",
      note: verification.note,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/order/${updatedOrder.id}`);

    if (updatedOrder.paymentLedgerId) {
      revalidatePath(`/admin/operations/ledger/${updatedOrder.paymentLedgerId}`);
    }

    return {
      status: 200,
      body: {
        ok: true,
        provider,
        idempotent: false,
        callbackId: verification.callbackId,
        orderId: updatedOrder.id,
        paymentStatus: verification.paymentStatus,
        transactionId: transaction.id,
      },
    };
  }

  if (provider === "khalti") {
    const verification = await verifyKhaltiCallback(values);

    if (!verification.ok) {
      return verification;
    }

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

    const updatedOrder = await updateOrderPayment(verification.order.id, {
      status: verification.paymentStatus,
      provider,
      reference: verification.paymentReference,
      transactionId: verification.paymentTransactionId,
      callbackId: verification.callbackId,
    });

    const transaction = await recordPaymentTransaction({
      orderId: updatedOrder.id,
      customerName: updatedOrder.name,
      amount: verification.amount,
      paymentStatus: verification.paymentStatus,
      paymentProvider: provider,
      paymentReference: verification.paymentReference,
      paymentTransactionId: verification.paymentTransactionId,
      paymentCallbackId: verification.callbackId,
      ledgerId: updatedOrder.paymentLedgerId,
      ledgerTransactionId: updatedOrder.paymentLedgerTransactionId,
      source: "gateway",
      note: verification.note,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/payments");
    revalidatePath(`/order/${updatedOrder.id}`);

    if (updatedOrder.paymentLedgerId) {
      revalidatePath(`/admin/operations/ledger/${updatedOrder.paymentLedgerId}`);
    }

    return {
      status: 200,
      body: {
        ok: true,
        provider,
        idempotent: false,
        callbackId: verification.callbackId,
        orderId: updatedOrder.id,
        paymentStatus: verification.paymentStatus,
        transactionId: transaction.id,
      },
    };
  }

  const callbackId = callbackIdFor(provider, values);
  const existing = await getPaymentTransactionByCallbackId(callbackId);

  if (existing) {
    return {
      status: 200,
      body: {
        ok: true,
        provider,
        idempotent: true,
        callbackId,
        orderId: existing.orderId,
        paymentStatus: existing.paymentStatus,
        message: "Callback was already processed.",
      },
    };
  }

  const orderId = textValue(values, ["orderId", "order_id", "purchase_order_id"]);
  const order = orderId ? await getOrderById(orderId) : null;

  if (!order) {
    return {
      status: 404,
      body: { ok: false, provider, callbackId, message: "Order was not found." },
    };
  }

  const amount = numberValue(values, ["amount", "total_amount", "totalAmount"]) || amountFromOrderTotal(order.total);
  const paymentStatus = callbackStatus(values);
  const paymentReference = textValue(values, ["reference", "paymentReference", "purchase_order_id"]) || order.paymentReference;
  const paymentTransactionId = textValue(values, [
    "transactionId",
    "transaction_id",
    "idx",
    "pidx",
    "refId",
    "ref_id",
  ]);

  const updatedOrder = await updateOrderPayment(order.id, {
    status: paymentStatus,
    provider,
    reference: paymentReference,
    transactionId: paymentTransactionId,
    callbackId,
  });

  const transaction = await recordPaymentTransaction({
    orderId: updatedOrder.id,
    customerName: updatedOrder.name,
    amount,
    paymentStatus,
    paymentProvider: provider,
    paymentReference,
    paymentTransactionId,
    paymentCallbackId: callbackId,
    ledgerId: updatedOrder.paymentLedgerId,
    ledgerTransactionId: updatedOrder.paymentLedgerTransactionId,
    source: "gateway",
    note: `Sandbox ${provider} callback accepted with status ${paymentStatus}.`,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/order/${updatedOrder.id}`);

  if (updatedOrder.paymentLedgerId) {
    revalidatePath(`/admin/operations/ledger/${updatedOrder.paymentLedgerId}`);
  }

  return {
    status: 200,
    body: {
      ok: true,
      provider,
      idempotent: false,
      callbackId,
      orderId: updatedOrder.id,
      paymentStatus,
      transactionId: transaction.id,
    },
  };
}
