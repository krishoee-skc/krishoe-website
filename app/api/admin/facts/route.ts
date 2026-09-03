import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getPosSnapshot } from "@/lib/pos";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import { getProductionControlSummary } from "@/lib/production-accounting";
import { getProducts } from "@/lib/product-store";
import { isLowOrOut } from "@/lib/stock-thresholds";
import { reportError } from "@/lib/report-error";

/**
 * The shop's own true numbers, for the command box to read.
 *
 * Every figure here is pulled from the same snapshot the dashboard renders —
 * getPosSnapshot, getPurchasingSnapshot, getProductionControlSummary — so this
 * route does no arithmetic of its own and cannot drift from what the owner sees
 * on the home screen. It is the single, trustworthy source the assistant will
 * be handed, so the assistant never has to (and never gets to) work a number
 * out for itself.
 *
 * Read-only and login-guarded by construction:
 *   - requireAdminPermission gates it, like every other admin route;
 *   - it only reads snapshots, and returns plain numbers — there is no code
 *     path here that writes, and none is added by the caller either.
 *
 * A table being briefly unavailable returns that one figure as null rather than
 * failing the whole answer; the caller says "I couldn't read that just now"
 * rather than guessing.
 */

export const dynamic = "force-dynamic";

async function safe<T>(what: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    reportError(`facts: ${what}`, error);
    return null;
  }
}

export async function GET() {
  const adminUser = await requireAdminPermission("production:entry");
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pos, purchasing, production, products] = await Promise.all([
    safe("pos snapshot", getPosSnapshot),
    safe("purchasing snapshot", getPurchasingSnapshot),
    safe("production summary", getProductionControlSummary),
    safe("products", () => getProducts({ includeDrafts: true })),
  ]);

  // Low-or-out list, named, so the answer can say which pairs — not just a
  // count. Drafts are included above so a low draft still surfaces; the name is
  // all that is exposed here.
  const lowStock = (products ?? [])
    .filter((product) => product && "stock" in product && isLowOrOut(Number(product.stock)))
    .map((product) => ({ name: product.name, stock: Number(product.stock) }));

  return NextResponse.json({
    // null means "could not read", never zero — zero is a real answer.
    todaySales: pos ? pos.summary.todayNetSales : null,
    todayPairs: pos ? pos.summary.todayPairs : null,
    creditOwed: pos ? pos.summary.totalCredit : null,
    workerOwed: production ? production.workerBalanceDue : null,
    todayGoodPairs: production ? production.todayGoodPairs : null,
    monthProfit: purchasing ? purchasing.summary.monthProfitEstimate : null,
    lowStock: products ? lowStock : null,
    lowStockCount: products ? lowStock.length : null,
  });
}
