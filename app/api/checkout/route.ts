import { updateCheckoutStep, applyPromoCode, getShippingMethods, calculateShippingCost } from "@/lib/checkout";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout
 * Update checkout progress or apply promo codes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, order_id, step, promo_code, subtotal, shipping_method_id, distance } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 }
      );
    }

    // Update checkout step
    if (action === "update_step" && step) {
      const validSteps = ["cart", "shipping", "payment", "confirmation"];
      if (!validSteps.includes(step)) {
        return NextResponse.json(
          { error: "Invalid checkout step" },
          { status: 400 }
        );
      }

      const result = await updateCheckoutStep(order_id, step as any);
      return NextResponse.json({
        ok: true,
        message: `Checkout step updated to ${step}`,
        order: result,
      });
    }

    // Apply promo code
    if (action === "apply_promo" && promo_code && subtotal) {
      try {
        const result = await applyPromoCode(order_id, promo_code, subtotal);
        return NextResponse.json({
          ok: true,
          ...result,
        });
      } catch (error) {
        return NextResponse.json(
          { error: (error as Error).message },
          { status: 400 }
        );
      }
    }

    // Calculate shipping
    if (action === "calculate_shipping" && shipping_method_id) {
      const cost = await calculateShippingCost(shipping_method_id, distance);
      return NextResponse.json({
        ok: true,
        shipping_cost: cost,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Checkout operation failed" },
      { status: 500 }
    );
  }
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
