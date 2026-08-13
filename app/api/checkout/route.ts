import { getShippingMethods } from "@/lib/checkout";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout
 * Update checkout progress or apply promo codes
 */
export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "This legacy checkout endpoint is disabled" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * GET /api/checkout/shipping-methods
 * Get available shipping methods
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "shipping-methods") {
      const methods = await getShippingMethods();
      return NextResponse.json({
        ok: true,
        methods,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Checkout GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch checkout data" },
      { status: 500 }
    );
  }
}
