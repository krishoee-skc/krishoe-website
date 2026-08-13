import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import {
  getOrderByPaymentReference,
  type OrderSubmission,
  type PaymentStatus,
} from "@/lib/submissions";

type EsewaPayload = Record<string, string>;

type EsewaVerificationResult =
  | {
      ok: true;
      order: OrderSubmission;
      amount: number;
      callbackId: string;
      paymentStatus: PaymentStatus;
      paymentReference: string;
      paymentTransactionId?: string;
      note: string;
      values: EsewaPayload;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

const provider = "esewa";
const requestSignedFields = ["total_amount", "transaction_uuid", "product_code"] as const;
const responseSignedFieldsFallback = [
  "transaction_code",
  "status",
  "total_amount",
  "transaction_uuid",
  "product_code",
  "signed_field_names",
] as const;

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

function textValue(values: EsewaPayload, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(values[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function productCode() {
  return envValue("ESEWA_MERCHANT_ID") || "EPAYTEST";
}

function secretKey() {
  return envValue("ESEWA_SECRET_KEY");
}

function shouldCheckStatusApi() {
  return (
    envValue("PAYMENT_MODE").toLowerCase() === "live" ||
    envValue("ESEWA_VERIFY_WITH_STATUS_CHECK").toLowerCase() === "true"
  );
}

function statusCheckUrl() {
  return (
    envValue("ESEWA_STATUS_CHECK_URL") ||
    (envValue("PAYMENT_MODE").toLowerCase() === "live"
      ? "https://epay.esewa.com.np/api/epay/transaction/status/"
      : "https://rc.esewa.com.np/api/epay/transaction/status/")
  );
}

function formUrl() {
  return (
    envValue("ESEWA_CHECKOUT_URL") ||
    (envValue("PAYMENT_MODE").toLowerCase() === "live"
      ? "https://epay.esewa.com.np/api/epay/main/v2/form"
      : "https://rc-epay.esewa.com.np/api/epay/main/v2/form")
  );
}

function createPaymentReference(orderId: string) {
  return `${provider.toUpperCase()}-${orderId}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function hmacBase64(message: string) {
  return createHmac("sha256", secretKey()).update(message).digest("base64");
}

function signatureMessage(values: EsewaPayload, signedFieldNames: string) {
  return signedFieldNames
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .map((field) => `${field}=${values[field] ?? ""}`)
    .join(",");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signFields(values: EsewaPayload, fields: readonly string[]) {
  const signedFieldNames = fields.join(",");
  return hmacBase64(signatureMessage(values, signedFieldNames));
}

function decodeBase64Json(value: string): EsewaPayload | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]),
    );
  } catch {
    return null;
  }
}

function encodeBase64Json(values: EsewaPayload) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64");
}

function normalizeStatus(status: string): PaymentStatus {
  const normalized = status.toUpperCase();

  if (normalized === "COMPLETE") {
    return "Paid";
  }

  if (normalized === "FULL_REFUND" || normalized === "PARTIAL_REFUND") {
    return "Refunded";
  }

  if (normalized === "PENDING" || normalized === "AMBIGUOUS") {
    return "Pending";
  }

  return "Failed";
}

function mergeCallbackValues(values: EsewaPayload) {
  const encodedData = textValue(values, ["data"]);
  const decodedValues = encodedData ? decodeBase64Json(encodedData) : null;

  return {
    values: decodedValues ? { ...values, ...decodedValues } : values,
    hasEncodedData: Boolean(decodedValues),
    encodedDataInvalid: Boolean(encodedData && !decodedValues),
  };
}

function callbackId(values: EsewaPayload) {
  const transactionUuid = textValue(values, ["transaction_uuid", "reference", "paymentReference"]);
  const transactionCode = textValue(values, ["transaction_code", "ref_id", "refId"]);

  return `${provider}:${transactionUuid || "unknown"}:${transactionCode || "no-ref"}`;
}

async function orderFromCallback(values: EsewaPayload) {
  const transactionUuid = textValue(values, ["transaction_uuid", "reference", "paymentReference"]);
  return transactionUuid ? getOrderByPaymentReference(transactionUuid) : null;
}

async function statusCheck(values: EsewaPayload) {
  const url = new URL(statusCheckUrl());
  const expectedAmount = textValue(values, ["total_amount", "amount"]);
  const expectedTransactionUuid = textValue(values, [
    "transaction_uuid",
    "reference",
    "paymentReference",
  ]);
  url.searchParams.set("product_code", productCode());
  url.searchParams.set("total_amount", expectedAmount);
  url.searchParams.set("transaction_uuid", expectedTransactionUuid);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: `eSewa status check failed with HTTP ${response.status}.`,
    };
  }

  const body = (await response.json()) as Record<string, unknown>;
  const status = cleanText(body.status);
  const responseProductCode = cleanText(body.product_code);
  const responseTransactionUuid = cleanText(body.transaction_uuid);
  const responseAmount = cleanNumber(body.total_amount);
  const amountMatches = responseAmount === cleanNumber(expectedAmount);
  const productMatches = !responseProductCode || responseProductCode === productCode();
  const transactionMatches =
    !responseTransactionUuid || responseTransactionUuid === expectedTransactionUuid;
  const callbackStatus = textValue(values, ["status"]);
  const statusMatches =
    !callbackStatus || normalizeStatus(status) === normalizeStatus(callbackStatus);

  return {
    ok: amountMatches && productMatches && transactionMatches && statusMatches,
    message: `eSewa status check returned ${status || "unknown"}.`,
    body,
    paymentStatus: normalizeStatus(status),
  };
}

export async function verifyEsewaReference(order: OrderSubmission): Promise<EsewaVerificationResult> {
  const paymentReference = order.paymentReference ?? "";
  const amount = amountFromOrderTotal(order.total);

  if (!paymentReference || amount <= 0) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Order has no valid pending eSewa reference." },
    };
  }

  const values: EsewaPayload = {
    total_amount: String(amount),
    transaction_uuid: paymentReference,
    product_code: productCode(),
  };
  const result = await statusCheck(values);

  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      body: { ok: false, provider, message: result.message },
    };
  }

  const transactionId = textValue(
    Object.fromEntries(
      Object.entries(result.body ?? {}).map(([key, value]) => [key, String(value ?? "")]),
    ),
    ["ref_id", "transaction_code"],
  );

  return {
    ok: true,
    order,
    amount,
    callbackId: `${provider}:${paymentReference}:${transactionId || result.paymentStatus || "Failed"}`,
    paymentStatus: result.paymentStatus ?? "Failed",
    paymentReference,
    paymentTransactionId: transactionId || undefined,
    note: result.message,
    values,
  };
}

export function createEsewaPayment({
  requestUrl,
  order,
  amount,
  reference,
}: {
  requestUrl: string;
  order: OrderSubmission;
  amount: number;
  reference?: string;
}) {
  const paymentReference = reference || createPaymentReference(order.id);
  const successUrl = new URL(`/api/payments/${provider}/callback`, requestUrl);
  const failureUrl = new URL(`/api/payments/${provider}/callback`, requestUrl);
  const fields: EsewaPayload = {
    amount: String(amount),
    tax_amount: "0",
    total_amount: String(amount),
    transaction_uuid: paymentReference,
    product_code: productCode(),
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: successUrl.toString(),
    failure_url: failureUrl.toString(),
    signed_field_names: requestSignedFields.join(","),
  };

  fields.signature = signFields(fields, requestSignedFields);

  if (envValue("PAYMENT_MODE").toLowerCase() !== "live") {
    const successData: EsewaPayload = {
      transaction_code: `SANDBOX-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "COMPLETE",
      total_amount: String(amount),
      transaction_uuid: paymentReference,
      product_code: productCode(),
      signed_field_names: responseSignedFieldsFallback.join(","),
    };
    successData.signature = signFields(successData, responseSignedFieldsFallback);
    successUrl.searchParams.set("data", encodeBase64Json(successData));
  }
  const failureData: EsewaPayload = {
    transaction_code: "",
    status: "FAILED",
    total_amount: String(amount),
    transaction_uuid: paymentReference,
    product_code: productCode(),
    signed_field_names: responseSignedFieldsFallback.join(","),
  };
  failureData.signature = signFields(failureData, responseSignedFieldsFallback);
  Object.entries(failureData).forEach(([key, value]) => failureUrl.searchParams.set(key, value));

  return {
    formUrl: formUrl(),
    fields,
    successUrl: successUrl.toString(),
    failureUrl: failureUrl.toString(),
  };
}

export async function verifyEsewaCallback(rawValues: EsewaPayload): Promise<EsewaVerificationResult> {
  const merged = mergeCallbackValues(rawValues);

  if (merged.encodedDataInvalid) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Invalid eSewa data payload." },
    };
  }

  const values = merged.values;
  const status = normalizeStatus(textValue(values, ["status"]));

  const signedFieldNames = textValue(values, ["signed_field_names"]);
  const receivedSignature = textValue(values, ["signature"]);

  if (!signedFieldNames || !receivedSignature) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Missing eSewa signature fields." },
    };
  }

  const receivedSignedFields = new Set(
    signedFieldNames.split(",").map((field) => field.trim()).filter(Boolean),
  );
  if (responseSignedFieldsFallback.some((field) => !receivedSignedFields.has(field))) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Incomplete eSewa signed fields." },
    };
  }

  const expectedSignature = hmacBase64(signatureMessage(values, signedFieldNames));

  if (!safeEqual(receivedSignature, expectedSignature)) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "Invalid eSewa callback signature." },
    };
  }

  if (textValue(values, ["product_code"]) && textValue(values, ["product_code"]) !== productCode()) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, provider, message: "eSewa product code mismatch." },
    };
  }

  const order = await orderFromCallback(values);

  if (!order) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, provider, message: "Order was not found for eSewa callback." },
    };
  }

  const amount = cleanNumber(textValue(values, ["total_amount", "amount"]));
  const expectedAmount = amountFromOrderTotal(order.total);

  if (amount <= 0 || (expectedAmount > 0 && amount !== expectedAmount)) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        provider,
        message: "eSewa amount mismatch.",
        expectedAmount,
        receivedAmount: amount,
      },
    };
  }

  let note = "eSewa callback signature verified.";

  if (shouldCheckStatusApi()) {
    const statusResult = await statusCheck(values);

    if (!statusResult.ok) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          provider,
          message: statusResult.message,
        },
      };
    }

    note = statusResult.message;
  }

  return {
    ok: true,
    order,
    amount,
    callbackId: callbackId(values),
    paymentStatus: status,
    paymentReference: textValue(values, ["transaction_uuid", "reference"]) || order.paymentReference || "",
    paymentTransactionId: textValue(values, ["transaction_code", "ref_id", "refId"]),
    note,
    values,
  };
}
