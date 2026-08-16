import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * A legacy endpoint, now fully closed.
 *
 * POST was already disabled. GET still offered `?action=shipping-methods`,
 * backed by a `shipping_methods` table that has never existed in this database
 * — so the one live path through this route was a guaranteed 500. Nothing in
 * the app called it; the shop's two delivery options come from
 * `shippingOptions` in lib/commerce.ts, and the checkout form reads them
 * directly.
 *
 * Kept as a 410 rather than deleted so anything holding the old URL is told the
 * endpoint is gone instead of timing out against a missing route.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This legacy checkout endpoint is disabled" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "This legacy checkout endpoint is disabled" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
