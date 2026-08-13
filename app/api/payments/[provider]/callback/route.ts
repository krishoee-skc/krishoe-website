import { NextResponse } from "next/server";
import {
  handleGatewayCallback,
  isGatewayProvider,
} from "@/lib/payment-gateways";
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

async function processCallback(request: Request, { params }: PaymentRouteContext) {
  const { provider } = await params;

  if (!isGatewayProvider(provider)) {
    return NextResponse.json(
      { ok: false, message: "Unsupported payment provider." },
      { status: 404 },
    );
  }

  try {
    const result = await handleGatewayCallback({
      provider,
      values: await requestValues(request),
      requestUrl: request.url,
    });

    const orderId = typeof result.body.orderId === "string" ? result.body.orderId : "";
    const paymentStatus =
      typeof result.body.paymentStatus === "string" ? result.body.paymentStatus : "";

    if (request.method === "GET" && orderId) {
      const destination = new URL(`/order/${encodeURIComponent(orderId)}`, request.url);
      destination.searchParams.set("payment", paymentStatus.toLowerCase() || "pending");
      return NextResponse.redirect(destination, 303);
    }

    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    reportError(`process ${provider} payment callback`, error);
    return NextResponse.json(
      { ok: false, provider, message: "Payment verification is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: Request, context: PaymentRouteContext) {
  return processCallback(request, context);
}

export async function POST(request: Request, context: PaymentRouteContext) {
  return processCallback(request, context);
}
