import {
  getOrderById,
  getOrderByPaymentReference,
  type OrderSubmission,
  type PaymentStatus,
} from "@/lib/submissions";
import { parseOrderTotalRupees } from "@/lib/payment-amount";

type KhaltiPayload = Record<string, string>;

type KhaltiLookupBody = {
  pidx?: string;
  total_amount?: number | string;
  status?: string;
  transaction_id?: string | null;
  fee?: number | string;
  refunded?: boolean;
  detail?: string;
  error_key?: string;
};

type KhaltiVerificationResult =
  | {
      ok: true;
      order: OrderSubmission;
      amount: number;
      callbackId: string;
      paymentStatus: PaymentStatus;
      paymentReference: string;
      paymentTransactionId?: string;
      note: string;
      values: KhaltiPayload;
      lookup: KhaltiLookupBody;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

const provider = "khalti";

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function amountFromOrderTotal(total: string) {
  return parseOrderTotalRupees(total);
}

function textValue(values: KhaltiPayload, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(values[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function secretKey() {
  return envValue("KHALTI_SECRET_KEY");
}

function apiBaseUrl() {
  return (envValue("KHALTI_API_BASE_URL") || "https://dev.khalti.com/api/v2").replace(/\/+$/, "");
}

function endpoint(pathname: string) {
  return `${apiBaseUrl()}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function normalizeStatus(status: string): PaymentStatus {
  const normalized = status.trim().toLowerCase();

  if (normalized === "completed") {
    return "Paid";
  }

  if (normalized === "refunded" || normalized === "partially refunded") {
    return "Refunded";
  }

  if (normalized === "expired" || normalized === "user canceled" || normalized === "canceled" || normalized === "failed") {
    return "Failed";
  }

  return "Pending";
}

async function khaltiPost<TBody extends Record<string, unknown>>(pathname: string, body: TBody) {
  const response = await fetch(endpoint(pathname), {
    method: "POST",
    headers: {
      Authorization: `Key ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  };
}

function callbackUrl(requestUrl: string, orderId: string) {
  const url = new URL(`/api/payments/${provider}/callback`, requestUrl);
  url.searchParams.set("orderId", orderId);
  return url.toString();
}

function websiteUrl(requestUrl: string) {
  const url = new URL(requestUrl);
  return url.origin;
}

export async function createKhaltiSandboxPayment({
  requestUrl,
  order,
  amount,
}: {
  requestUrl: string;
  order: OrderSubmission;
  amount: number;
}) {
  const amountInPaisa = amount * 100;
  const result = await khaltiPost("/epayment/initiate/", {
    return_url: callbackUrl(requestUrl, order.id),
    website_url: websiteUrl(requestUrl),
    amount: amountInPaisa,
    purchase_order_id: order.id,
    purchase_order_name: `KRISHOE order ${order.id}`,
    customer_info: {
      name: order.name,
      email: order.email ?? "",
      phone: order.phone,
    },
    merchant_order_id: order.id,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      status: result.status,
      body: result.body,
    };
  }

  return {
    ok: true as const,
    pidx: cleanText(result.body.pidx),
    paymentUrl: cleanText(result.body.payment_url),
    expiresAt: cleanText(result.body.expires_at),
    expiresIn: cleanNumber(result.body.expires_in),
    body: result.body,
  };
}

async function orderFromCallback(values: KhaltiPayload, pidx: string) {
  const orderId = textValue(values, ["orderId", "order_id", "purchase_order_id", "merchant_order_id"]);

  if (orderId) {
    const order = await getOrderById(orderId);

    if (order) {
      return order;
    }
  }

  return getOrderByPaymentReference(pidx);
}

async function lookupPayment(pidx: string) {
  const result = await khaltiPost("/epayment/lookup/", { pidx });
  const lookup = result.body as KhaltiLookupBody;

  if (!result.ok && !lookup.status) {
    return {
      ok: false as const,
      status: result.status,
      body: result.body,
    };
  }

  return {
    ok: true as const,
    status: result.status,
    body: lookup,
  };
}

export async function verifyKhaltiCallback(rawValues: KhaltiPayload): Promise<KhaltiVerificationResult> {
  const pidx = textValue(rawValues, ["pidx", "paymentReference", "reference"]);

  if (!pidx) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Missing Khalti pidx." },
    };
  }

  const order = await orderFromCallback(rawValues, pidx);

  if (!order) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, provider, message: "Order was not found for Khalti callback." },
    };
  }

  const lookupResult = await lookupPayment(pidx);

  if (!lookupResult.ok) {
    return {
      ok: false,
      status: lookupResult.status,
      body: {
        ok: false,
        provider,
        message: "Khalti lookup failed.",
        detail: lookupResult.body,
      },
    };
  }

  const lookup = lookupResult.body;
  const amountInPaisa = cleanNumber(lookup.total_amount);
  const expectedAmountInPaisa = amountFromOrderTotal(order.total) * 100;

  if (amountInPaisa <= 0 || (expectedAmountInPaisa > 0 && amountInPaisa !== expectedAmountInPaisa)) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        provider,
        message: "Khalti amount mismatch.",
        expectedAmount: expectedAmountInPaisa,
        receivedAmount: amountInPaisa,
      },
    };
  }

  const paymentStatus = normalizeStatus(cleanText(lookup.status));
  const transactionId = cleanText(lookup.transaction_id);

  return {
    ok: true,
    order,
    amount: Math.round(amountInPaisa / 100),
    callbackId: `${provider}:${pidx}:${transactionId || cleanText(lookup.status) || "no-transaction"}`,
    paymentStatus,
    paymentReference: pidx,
    paymentTransactionId: transactionId || pidx,
    note: `Khalti lookup returned ${cleanText(lookup.status) || "unknown"}.`,
    values: rawValues,
    lookup,
  };
}
