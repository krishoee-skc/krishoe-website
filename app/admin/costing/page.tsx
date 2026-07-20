import Link from "next/link";
import ExportButton from "@/components/admin/ExportButton";
import type { Metadata } from "next";
import { updateCostingSettingsAction } from "@/app/admin/costing/actions";
import {
  getCostingSnapshot,
  type BatchCostingRow,
  type CatalogStockReconciliationRow,
  type DesignCostingRow,
  type DesignCostSource,
  type FinishedStockValuationRow,
} from "@/lib/costing";
import { laborRateFieldName, productionStations, type CostingSettings } from "@/lib/costing-settings";

export const metadata: Metadata = {
  title: "Costing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-20 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function rate(value: number) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function overheadPerPair(settings: CostingSettings) {
  const monthlyAllocation =
    settings.monthlyCapacityPairs > 0
      ? settings.monthlyFixedOverhead / settings.monthlyCapacityPairs
      : 0;

  return (
    settings.factoryOverheadPerPair +
    settings.electricityPerPair +
    settings.rentPerPair +
    settings.miscellaneousPerPair +
    monthlyAllocation
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass = {
    default: "border-gray-200 bg-white text-brand-green-ink",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-lg border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-65">
        {detail}
      </p>
    </div>
  );
}

// KRISHOE both makes chappals and buys finished slippers to resell. The two are
// costed differently — a made pair carries material, labour and overhead; a
// bought pair carries what the supplier charged — so the row says which it is
// rather than leaving the reader to guess from a blended number.
function CostSourcePill({ source }: { source: DesignCostSource }) {
  if (source === "Made") {
    return (
      <span className="inline-flex rounded-full border border-brand-green/20 bg-brand-green/5 px-2.5 py-1 text-xs font-black text-brand-green">
        Made
      </span>
    );
  }

  if (source === "Bought") {
    return (
      <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-800">
        Bought
      </span>
    );
  }

  if (source === "Made and bought") {
    return (
      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-800">
        Made + bought
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-600">
      Sold only
    </span>
  );
}

function DesignPairsDetail({ row }: { row: DesignCostingRow }) {
  const parts: string[] = [];

  if (row.batchCount > 0) {
    parts.push(`${row.batchCount} batches, ${row.finishedPairs} made`);
  }

  if (row.purchasedPairs > 0) {
    parts.push(`${row.purchasedPairs} bought`);
  }

  // A design that was only ever sold has neither, and saying "0 batches" would
  // point at production for something production never touched.
  return <>{parts.length > 0 ? parts.join(" | ") : "No cost recorded yet"}</>;
}

function DesignCostBreakdown({ row }: { row: DesignCostingRow }) {
  const parts: string[] = [];

  if (row.productionCost > 0) {
    parts.push(`M ${money(row.materialCost)} | L ${money(row.laborCost)} | O ${money(row.overheadCost)}`);
  }

  if (row.purchaseCost > 0) {
    parts.push(`Bought ${money(row.purchaseCost)}`);
  }

  return <>{parts.length > 0 ? parts.join(" | ") : "—"}</>;
}

function StatusPill({ row }: { row: DesignCostingRow }) {
  if (row.missingCostData) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
        Needs cost
      </span>
    );
  }

  if (row.grossProfit < 0) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-800">
        Loss
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
      Healthy
    </span>
  );
}

function BatchStatusPill({ row }: { row: BatchCostingRow }) {
  if (row.missingCostMaterials.length > 0 || row.missingLaborStations.length > 0 || row.missingOverheadRate) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
        Needs rate
      </span>
    );
  }

  if (row.consumptionCount === 0) {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-700">
        No usage
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
      Costed
    </span>
  );
}

function FinishedStockSignalPill({ row }: { row: FinishedStockValuationRow }) {
  if (row.signal === "Needs cost") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
        Needs cost
      </span>
    );
  }

  if (row.signal === "Needs price") {
    return (
      <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-800">
        Needs price
      </span>
    );
  }

  if (row.signal === "Loss risk") {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-800">
        Loss risk
      </span>
    );
  }

  if (row.signal === "No stock") {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-black text-gray-700">
        No stock
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
      Profit ready
    </span>
  );
}

function CatalogSyncPill({ row }: { row: CatalogStockReconciliationRow }) {
  if (row.signal === "Matched") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
        Matched
      </span>
    );
  }

  if (row.signal === "No catalog product" || row.signal === "No operations stock") {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-800">
        {row.signal}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
      {row.signal}
    </span>
  );
}

export default async function AdminCostingPage() {
  const costing = await getCostingSnapshot();

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">COGS and design profit</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Material, labor, factory overhead, production batch COGS, and POS design margin in one control view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            href="/api/admin/costing/export?type=designs"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            Export designs
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=materials"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export materials
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=stock-valuation"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Raw stock value
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=finished-stock-value"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Finished value
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=catalog-stock-sync"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Catalog sync
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=batches"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export batches
          </ExportButton>
          <ExportButton
            href="/api/admin/costing/export?type=periods"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export periods
          </ExportButton>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Material purchase"
          value={money(costing.summary.materialPurchaseCost)}
          detail={`${costing.summary.pricedMaterialCount} priced materials`}
        />
        <StatCard
          label="Trading goods purchase"
          value={money(costing.summary.tradingGoodsPurchaseCost)}
          detail={`${costing.summary.tradingGoodsPurchasedPairs} pairs bought to resell`}
        />
        <StatCard
          label="Raw stock value"
          value={money(costing.summary.rawMaterialStockValue)}
          detail={`${costing.summary.unpricedStockMaterialCount} unpriced stock items`}
          tone={costing.summary.unpricedStockMaterialCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Low stock need"
          value={money(costing.summary.lowStockMaterialValue)}
          detail="estimated reorder value"
          tone={costing.summary.lowStockMaterialValue > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Finished stock value"
          value={money(costing.summary.finishedStockValue)}
          detail={`${costing.summary.finishedStockMissingCostCount} cost gaps`}
          tone={costing.summary.finishedStockMissingCostCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Inventory profit"
          value={money(costing.summary.finishedStockPotentialProfit)}
          detail={`${costing.summary.finishedStockMissingPriceCount} price gaps`}
          tone={costing.summary.finishedStockPotentialProfit >= 0 ? "good" : "danger"}
        />
        <StatCard
          label="Catalog mismatch"
          value={costing.summary.catalogStockMismatchCount}
          detail={`${costing.summary.catalogStockDeltaPairs} pair delta`}
          tone={costing.summary.catalogStockMismatchCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Labor COGS"
          value={money(costing.summary.laborCost)}
          detail="worker task allocation"
          tone={costing.summary.laborCost > 0 ? "good" : "warn"}
        />
        <StatCard
          label="Overhead COGS"
          value={money(costing.summary.overheadCost)}
          detail={`${money(overheadPerPair(costing.settings))} per pair model`}
          tone={costing.summary.overheadCost > 0 ? "good" : "warn"}
        />
        <StatCard
          label="Production COGS"
          value={money(costing.summary.productionCost)}
          detail="material + labor + overhead"
        />
        <StatCard
          label="Sales revenue"
          value={money(costing.summary.salesRevenue)}
          detail={`${costing.designCosting.length} designs tracked`}
        />
        <StatCard
          label="Gross profit"
          value={money(costing.summary.grossProfit)}
          detail={`${costing.summary.grossMarginRate}% margin`}
          tone={costing.summary.grossProfit >= 0 ? "good" : "danger"}
        />
      </div>

      {costing.summary.missingCostDesigns > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {costing.summary.missingCostDesigns} design rows need material, labor, or overhead rates before margin becomes fully accurate.
        </div>
      ) : null}

      <form action={updateCostingSettingsAction} className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Factory cost model</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set real labor and overhead rates to turn COGS into true production profit.
            </p>
          </div>
          <button
            type="submit"
            className="h-10 rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Save cost model
          </button>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">
              Labor per completed pair
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {productionStations.map((station) => (
                <label key={station} className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  {station}
                  <input
                    name={laborRateFieldName(station)}
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    defaultValue={costing.settings.laborRates[station]}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">
                Factory overhead allocation
              </p>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-black text-brand-green-ink">
                Effective {money(overheadPerPair(costing.settings))}/pair
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Factory overhead/pair
                <input
                  name="factoryOverheadPerPair"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  defaultValue={costing.settings.factoryOverheadPerPair}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Electricity/pair
                <input
                  name="electricityPerPair"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  defaultValue={costing.settings.electricityPerPair}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Rent/pair
                <input
                  name="rentPerPair"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  defaultValue={costing.settings.rentPerPair}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Misc./pair
                <input
                  name="miscellaneousPerPair"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  defaultValue={costing.settings.miscellaneousPerPair}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Monthly fixed overhead
                <input
                  name="monthlyFixedOverhead"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  defaultValue={costing.settings.monthlyFixedOverhead}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                Monthly capacity pairs
                <input
                  name="monthlyCapacityPairs"
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  defaultValue={costing.settings.monthlyCapacityPairs}
                />
              </label>
            </div>
            <textarea
              name="note"
              className={`${textareaClass} mt-3 w-full`}
              defaultValue={costing.settings.note}
              placeholder="Cost model note, salary basis, rent/electricity period, or approval reference."
            />
          </div>
        </div>
      </form>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">Profit periods</h2>
          <p className="mt-1 text-sm text-gray-500">
            Daily, monthly, and yearly sales profit after estimated full COGS.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {costing.periodReports.map((row) => (
            <div key={row.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-black text-brand-green-ink">{row.label}</p>
              <p className="mt-2 text-2xl font-black text-brand-green">{money(row.grossProfit)}</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Revenue {money(row.revenue)} | COGS {money(row.estimatedCogs)} | {row.grossMarginRate}%
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {row.netPairs} net pairs, {row.returnedPairs} returned
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Catalog stock reconciliation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Online product catalog stock compared with operations finished stock by design, SKU, and product id.
            </p>
          </div>
          <Link href="/admin/products" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Open products
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Catalog product</th>
                <th className="py-2 pr-3">Operations design</th>
                <th className="py-2 pr-3">Catalog stock</th>
                <th className="py-2 pr-3">Operations stock</th>
                <th className="py-2 pr-3">Delta</th>
                <th className="py-2 pr-3">Channels</th>
                <th className="py-2 pr-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {costing.catalogStockReconciliation.slice(0, 20).map((row) => (
                <tr key={row.key}>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.productName || "-"}</p>
                    <p className="text-xs text-gray-500">
                      {row.sku || "-"} | {row.productStatus} | {money(row.catalogPrice)}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-semibold text-brand-green-ink">{row.operationsDesign || "-"}</td>
                  <td className="py-3 pr-3">{row.catalogStock}</td>
                  <td className="py-3 pr-3">{row.operationsStockPairs}</td>
                  <td className="py-3 pr-3 font-black text-brand-clay">{row.stockDelta}</td>
                  <td className="max-w-64 py-3 pr-3 text-gray-600">{row.channelBreakdown}</td>
                  <td className="py-3 pr-3">
                    <CatalogSyncPill row={row} />
                  </td>
                </tr>
              ))}
              {costing.catalogStockReconciliation.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={7}>
                    No catalog stock reconciliation rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Design profitability</h2>
            <p className="mt-1 text-sm text-gray-500">
              Sales revenue minus estimated COGS from production unit cost.
            </p>
          </div>
          <Link href="/admin/pos" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Open POS
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Sold</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Unit COGS</th>
                <th className="py-2 pr-3">Est. COGS</th>
                <th className="py-2 pr-3">Gross profit</th>
                <th className="py-2 pr-3">Margin</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {costing.designCosting.slice(0, 20).map((row) => (
                <tr key={row.design}>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.design}</p>
                    <p className="text-xs text-gray-500">
                      <DesignPairsDetail row={row} />
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <CostSourcePill source={row.costSource} />
                  </td>
                  <td className="py-3 pr-3 text-brand-green-ink">
                    {row.netPairs}
                    {row.returnedPairs > 0 ? (
                      <span className="block text-xs text-gray-500">{row.returnedPairs} returned</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-semibold">{money(row.netRevenue)}</td>
                  <td className="py-3 pr-3">
                    {money(row.unitCostPerPair)}
                    <span className="block text-xs text-gray-500">
                      <DesignCostBreakdown row={row} />
                    </span>
                  </td>
                  <td className="py-3 pr-3">{money(row.estimatedCogs)}</td>
                  <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.grossProfit)}</td>
                  <td className="py-3 pr-3">{row.grossMarginRate}%</td>
                  <td className="py-3 pr-3">
                    <StatusPill row={row} />
                  </td>
                </tr>
              ))}
              {costing.designCosting.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={9}>
                    No design costing data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Finished stock valuation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ready stock valued with design unit COGS and recent POS average selling price.
            </p>
          </div>
          <Link href="/admin/operations" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Open finished stock
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Design</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Unit COGS</th>
                <th className="py-2 pr-3">Avg sale</th>
                <th className="py-2 pr-3">Stock value</th>
                <th className="py-2 pr-3">Profit potential</th>
                <th className="py-2 pr-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {costing.finishedStockValuation.map((row) => (
                <tr key={row.stockId}>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.design}</p>
                    <p className="text-xs text-gray-500">{row.sizeRun}</p>
                  </td>
                  <td className="py-3 pr-3">{row.channel}</td>
                  <td className="py-3 pr-3">
                    {row.stockPairs}
                    <span className="block text-xs text-gray-500">
                      Sold {row.soldPairs}, return {row.returnedPairs}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{money(row.unitCostPerPair)}</td>
                  <td className="py-3 pr-3">
                    {money(row.averageSalePrice)}
                    <span className="block text-xs text-gray-500">{row.priceSource}</span>
                  </td>
                  <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.stockValue)}</td>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green">{money(row.potentialGrossProfit)}</p>
                    <p className="text-xs text-gray-500">
                      Revenue {money(row.potentialRevenue)} | {row.potentialMarginRate}%
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <FinishedStockSignalPill row={row} />
                  </td>
                </tr>
              ))}
              {costing.finishedStockValuation.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={8}>
                    No finished stock valuation data yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Material cost rates</h2>
              <p className="mt-1 text-sm text-gray-500">
                Weighted average from purchase invoices.
              </p>
            </div>
            <Link href="/admin/purchasing" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Open purchasing
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Avg rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {costing.materialCostRates.map((row) => (
                  <tr key={row.materialId || row.materialName}>
                    <td className="py-3 pr-3">
                      <p className="font-bold text-brand-green-ink">{row.materialName}</p>
                      <p className="text-xs text-gray-500">{row.invoiceCount} invoices, {row.unit}</p>
                    </td>
                    <td className="py-3 pr-3">{rate(row.purchasedQuantity)}</td>
                    <td className="py-3 pr-3 font-semibold">{money(row.purchaseTotal)}</td>
                    <td className="py-3 pr-3">{money(row.averageUnitCost)}</td>
                  </tr>
                ))}
                {costing.materialCostRates.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={4}>
                      No purchase rates yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Batch costing</h2>
              <p className="mt-1 text-sm text-gray-500">
                Raw material usage and wastage converted into batch COGS.
              </p>
            </div>
            <Link href="/admin/operations" className="text-sm font-bold text-brand-green underline underline-offset-4">
              Open operations
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Finished</th>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">Labor</th>
                  <th className="py-2 pr-3">Overhead</th>
                  <th className="py-2 pr-3">Total COGS</th>
                  <th className="py-2 pr-3">Unit COGS</th>
                  <th className="py-2 pr-3">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {costing.batchCosting.slice(0, 20).map((row) => (
                  <tr key={row.batchId}>
                    <td className="py-3 pr-3">
                      <p className="font-mono text-xs font-bold text-brand-green-ink">{row.batchId}</p>
                      <p className="text-xs text-gray-500">{row.design}</p>
                    </td>
                    <td className="py-3 pr-3">{row.status}</td>
                    <td className="py-3 pr-3">
                      {row.finishedPairs}/{row.plannedPairs}
                      {row.rejectedPairs > 0 ? (
                        <span className="block text-xs text-red-700">{row.rejectedPairs} rejected</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">{money(row.materialCost)}</td>
                    <td className="py-3 pr-3">{money(row.laborCost)}</td>
                    <td className="py-3 pr-3">{money(row.overheadCost)}</td>
                    <td className="py-3 pr-3 font-semibold">{money(row.totalProductionCost)}</td>
                    <td className="py-3 pr-3">{money(row.unitCostPerPair)}</td>
                    <td className="py-3 pr-3">
                      <BatchStatusPill row={row} />
                      {row.missingCostMaterials.length > 0 ? (
                        <p className="mt-1 text-xs text-gray-500">{row.missingCostMaterials.join(", ")}</p>
                      ) : null}
                      {row.missingLaborStations.length > 0 ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Labor: {row.missingLaborStations.join(", ")}
                        </p>
                      ) : null}
                      {row.missingOverheadRate ? (
                        <p className="mt-1 text-xs text-gray-500">Overhead rate missing</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {costing.batchCosting.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-gray-500" colSpan={9}>
                      No production batches yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Raw material stock valuation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Current raw material balance valued with weighted purchase cost from supplier invoices.
            </p>
          </div>
          <Link href="/admin/purchasing" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Update purchase rates
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Balance</th>
                <th className="py-2 pr-3">Avg cost</th>
                <th className="py-2 pr-3">Stock value</th>
                <th className="py-2 pr-3">Reorder need</th>
                <th className="py-2 pr-3">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {costing.rawMaterialStockValuation.map((row) => (
                <tr key={row.materialId}>
                  <td className="py-3 pr-3">
                    <p className="font-bold text-brand-green-ink">{row.materialName}</p>
                    <p className="text-xs text-gray-500">
                      {row.invoiceCount} purchase invoices, {row.unit}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    {rate(row.balance)}
                    <span className="block text-xs text-gray-500">Reorder {rate(row.reorderLevel)}</span>
                  </td>
                  <td className="py-3 pr-3">{money(row.averageUnitCost)}</td>
                  <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.stockValue)}</td>
                  <td className="py-3 pr-3">
                    {rate(row.reorderShortage)}
                    <span className="block text-xs text-gray-500">{money(row.reorderValue)}</span>
                  </td>
                  <td className="py-3 pr-3">
                    {!row.hasPurchaseRate ? (
                      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-black text-red-800">
                        Rate missing
                      </span>
                    ) : row.lowStock ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                        Reorder
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                        Valued
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {costing.rawMaterialStockValuation.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={6}>
                    No raw material stock to value yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
