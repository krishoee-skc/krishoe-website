import { NextResponse } from "next/server";
import {
  initiatePayment,
  isGatewayProvider,
} from "@/lib/payment-gateways";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaymentRouteContext = {
  params: Promise<{ provider: string }>;
};

async function requestValues(request: Request) {
  const url = new URL(request.url);
  const values = Object.fromEntries(url.searchParams.entries());
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    for (const [key, value] of Object.entries(body)) {
      values[key] = typeof value === "string" ? value : String(value ?? "");
    }
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();

    for (const [key, value] of formData.entries()) {
      values[key] = typeof value === "string" ? value : value.name;
    }
  }

  return values;
}

export async function POST(request: Request, { params }: PaymentRouteContext) {
  const { provider } = await params;

  if (!isGatewayProvider(provider)) {
    return NextResponse.json(
      { ok: false, message: "Unsupported payment provider." },
      { status: 404 },
    );
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json(
      { ok: false, message: "Sign in to pay for this order." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "payment-initiation",
    key: `${customer.id}:${provider}`,
    maxAttempts: 6,
    windowMs: 10 * 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { ok: false, message: "Too many payment attempts. Please wait and try again." },
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
    const result = await initiatePayment({
      provider,
      values: await requestValues(request),
      requestUrl: request.url,
      customer,
    });

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    reportError(`initiate ${provider} payment`, error);
    return NextResponse.json(
      { ok: false, provider, message: "Payment could not be started right now." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
