import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";
import {
  isGatewayProvider,
  reconcilePayment,
} from "@/lib/payment-gateways";
import { reportError } from "@/lib/report-error";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaymentRouteContext = {
  params: Promise<{ provider: string }>;
};

export async function POST(request: Request, { params }: PaymentRouteContext) {
  const { provider } = await params;
  if (!isGatewayProvider(provider)) {
    return NextResponse.json(
      { ok: false, message: "Unsupported payment provider." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json(
      { ok: false, message: "Sign in to check this payment." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json(
      { ok: false, message: "Order ID is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "payment-status",
    key: `${customer.id}:${provider}:${orderId}`,
    maxAttempts: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { ok: false, message: "Too many status checks. Please wait and try again." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const result = await reconcilePayment({
      provider,
      orderId,
      requestUrl: request.url,
      customer,
    });
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    reportError(`reconcile ${provider} payment`, error);
    return NextResponse.json(
      { ok: false, provider, message: "Payment status could not be checked right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
