import { NextResponse } from "next/server";
import {
  initiateSandboxPayment,
  isGatewayProvider,
} from "@/lib/payment-gateways";

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

  const result = await initiateSandboxPayment({
    provider,
    values: await requestValues(request),
    requestUrl: request.url,
  });

  return NextResponse.json(result.body, { status: result.status });
}
