import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  getOrderById,
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
  return cleanNumber(total.replace(/[^\d.]/g, ""));
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
  return envValue("ESEWA_VERIFY_WITH_STATUS_CHECK").toLowerCase() === "true";
}

function statusCheckUrl() {
  return (
    envValue("ESEWA_STATUS_CHECK_URL") ||
    "https://rc.esewa.com.np/api/epay/transaction/status/"
  );
}

function formUrl() {
  return (
    envValue("ESEWA_CHECKOUT_URL") ||
    "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
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
  const orderId = textValue(values, ["orderId", "order_id"]);
  const transactionUuid = textValue(values, ["transaction_uuid", "reference", "paymentReference"]);

  if (orderId) {
    const order = await getOrderById(orderId);

    if (order) {
      return order;
    }
  }

  return transactionUuid ? getOrderByPaymentReference(transactionUuid) : null;
}

async function statusCheck(values: EsewaPayload) {
  const url = new URL(statusCheckUrl());
  url.searchParams.set("product_code", productCode());
  url.searchParams.set("total_amount", textValue(values, ["total_amount", "amount"]));
  url.searchParams.set("transaction_uuid", textValue(values, ["transaction_uuid"]));

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return {
      ok: false,
      message: `eSewa status check failed with HTTP ${response.status}.`,
    };
  }

  const body = (await response.json()) as Record<string, unknown>;
  const status = cleanText(body.status);

  return {
    ok: normalizeStatus(status) === normalizeStatus(textValue(values, ["status"])),
    message: `eSewa status check returned ${status || "unknown"}.`,
    body,
  };
}

export function createEsewaSandboxPayment({
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
  failureUrl.searchParams.set("orderId", order.id);
  failureUrl.searchParams.set("status", "failed");
  failureUrl.searchParams.set("reference", paymentReference);
  failureUrl.searchParams.set("amount", String(amount));

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

  if (status === "Paid" || merged.hasEncodedData) {
    const signedFieldNames = textValue(values, ["signed_field_names"]);
    const receivedSignature = textValue(values, ["signature"]);

    if (!signedFieldNames || !receivedSignature) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, provider, message: "Missing eSewa signature fields." },
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

  if (status === "Paid" && shouldCheckStatusApi()) {
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
