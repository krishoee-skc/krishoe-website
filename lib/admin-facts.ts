import { getPosSnapshot } from "@/lib/pos";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import { getProductionControlSummary } from "@/lib/production-accounting";
import { getProducts } from "@/lib/product-store";
import { isLowOrOut } from "@/lib/stock-thresholds";
import { reportError } from "@/lib/report-error";
import type { AdminFacts } from "@/lib/ai/admin-assistant-prompt";

/**
 * The shop's own true numbers, read in one place.
 *
 * Both the facts API and the assistant need exactly the same figures, and they
 * must never drift from each other or from the dashboard. So the reading lives
 * here, once: every figure comes straight from the same snapshot the dashboard
 * renders (getPosSnapshot, getPurchasingSnapshot, getProductionControlSummary),
 * and this function does no arithmetic of its own beyond filtering the
 * low-stock list. A source that is briefly unavailable yields null for that one
 * figure — never a zero, which would read as a real, wrong answer.
 *
 * Read-only: it only calls snapshot readers. There is no write path here.
 */

async function safe<T>(what: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    reportError(`admin facts: ${what}`, error);
    return null;
  }
}

export async function readAdminFacts(): Promise<AdminFacts> {
  const [pos, purchasing, production, products] = await Promise.all([
    safe("pos snapshot", getPosSnapshot),
    safe("purchasing snapshot", getPurchasingSnapshot),
    safe("production summary", getProductionControlSummary),
    safe("products", () => getProducts({ includeDrafts: true })),
  ]);

  const lowStock = (products ?? [])
    .filter((product) => product && "stock" in product && isLowOrOut(Number(product.stock)))
    .map((product) => ({ name: product.name, stock: Number(product.stock) }));

  return {
    // null means "could not read", never zero — zero is a real answer.
    todaySales: pos ? pos.summary.todayNetSales : null,
    todayPairs: pos ? pos.summary.todayPairs : null,
    creditOwed: pos ? pos.summary.totalCredit : null,
    workerOwed: production ? production.workerBalanceDue : null,
    todayGoodPairs: production ? production.todayGoodPairs : null,
    monthProfit: purchasing ? purchasing.summary.monthProfitEstimate : null,
    lowStock: products ? lowStock : null,
    lowStockCount: products ? lowStock.length : null,
  };
}
