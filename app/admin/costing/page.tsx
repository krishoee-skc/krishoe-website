import EnterWalkForm from "@/components/admin/EnterWalkForm";
import Link from "next/link";
import StatCard from "@/components/admin/StatTile";
import T from "@/components/T";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import type { Metadata } from "next";
import { updateCostingSettingsAction } from "@/app/admin/costing/actions";
import {
  getCostingSnapshot,
  // The same overhead the costing engine works in, not a second copy of the
  // sum. This page carried its own, and the two had already drifted: the
  // library rounds to the paisa and guards a non-finite result, the copy did
  // neither — so the card read 61.10933333333334 where every figure it sat
  // beside was computed from 61.11, and a half-filled settings form printed
  // NaN on the screen instead of the library's 0.
  overheadPerPair,
  type BatchCostingRow,
  type CatalogStockReconciliationRow,
  type DesignCostingRow,
  type DesignCostSource,
  type FinishedStockValuationRow,
} from "@/lib/costing";
import { money } from "@/lib/format-money";
import { laborRateFieldName, productionStations } from "@/lib/costing-settings";

export const metadata: Metadata = {
  title: "Costing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-brand-green-line bg-brand-paper px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-20 rounded-md border border-brand-green-line bg-brand-paper px-3 py-2 text-sm outline-none focus:border-brand-green";
const sectionClass = "rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm";
const pill = "inline-flex rounded-full border px-2.5 py-1 text-xs font-black";

function rate(value: number) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

/** A column heading in both languages, the same on every table here. */
function Th({ en, ne }: { en: string; ne: string }) {
  return (
    <th className="py-2 pr-3">
      <T en={en} ne={ne} />
    </th>
  );
}

const PERIOD: Record<string, { ne: string }> = {
  Today: { ne: "आज" },
  "This month": { ne: "यो महिना" },
  "This year": { ne: "यो वर्ष" },
};
const CHANNEL: Record<string, { ne: string }> = {
  Factory: { ne: "कारखाना" },
  Retail: { ne: "खुद्रा" },
  Wholesale: { ne: "थोक" },
  Online: { ne: "अनलाइन" },
};

// KRISHOE both makes chappals and buys finished slippers to resell. The two are
// costed differently — a made pair carries material, labour and overhead; a
// bought pair carries what the supplier charged — so the row says which it is
// rather than leaving the reader to guess from a blended number.
function CostSourcePill({ source }: { source: DesignCostSource }) {
  if (source === "Made") {
    return (
      <span className={`${pill} border-brand-green/20 bg-brand-green/5 text-brand-green`}>
        <T en="Made" ne="बनाएको" />
      </span>
    );
  }

  if (source === "Bought") {
    return (
      <span className={`${pill} border-sky-200 bg-sky-50 text-sky-800`}>
        <T en="Bought" ne="किनेको" />
      </span>
    );
  }

  if (source === "Made and bought") {
    return (
      <span className={`${pill} border-violet-200 bg-violet-50 text-violet-800`}>
        <T en="Made + bought" ne="बनाएको + किनेको" />
      </span>
    );
  }

  return (
    <span className={`${pill} border-brand-green-line bg-brand-paper-deep text-brand-muted`}>
      <T en="Sold only" ne="बेचेको मात्र" />
    </span>
  );
}

function DesignPairsDetail({ row }: { row: DesignCostingRow }) {
  const parts: Array<{ en: string; ne: string }> = [];

  if (row.batchCount > 0) {
    parts.push({ en: `${row.batchCount} batches, ${row.finishedPairs} made`, ne: `${row.batchCount} lot, ${row.finishedPairs} बनेको` });
  }

  if (row.purchasedPairs > 0) {
    parts.push({ en: `${row.purchasedPairs} bought`, ne: `${row.purchasedPairs} किनेको` });
  }
  const en = parts.map((part) => part.en);
  const ne = parts.map((part) => part.ne);

  // A design that was only ever sold has neither, and saying "0 batches" would
  // point at production for something production never touched.
  return en.length > 0 ? <T en={en.join(" | ")} ne={ne.join(" | ")} /> : <T en="No cost recorded yet" ne="लागत अझै टिपिएको छैन" />;
}

function DesignCostBreakdown({ row }: { row: DesignCostingRow }) {
  const parts: Array<{ en: string; ne: string }> = [];

  if (row.productionCost > 0) {
    parts.push({
      en: `M ${money(row.materialCost)} | L ${money(row.laborCost)} | O ${money(row.overheadCost)}`,
      ne: `कच्चा ${money(row.materialCost)} | ज्याला ${money(row.laborCost)} | अरू ${money(row.overheadCost)}`,
    });
  }

  if (row.purchaseCost > 0) {
    parts.push({ en: `Bought ${money(row.purchaseCost)}`, ne: `किनेको ${money(row.purchaseCost)}` });
  }
  const en = parts.map((part) => part.en);
  const ne = parts.map((part) => part.ne);

  return en.length > 0 ? <T en={en.join(" | ")} ne={ne.join(" | ")} /> : <>—</>;
}

function StatusPill({ row }: { row: DesignCostingRow }) {
  if (row.missingCostData) {
    return (
      <span className={`${pill} border-amber-200 bg-amber-50 text-amber-800`}>
        <T en="Needs cost" ne="लागत चाहियो" />
      </span>
    );
  }

  if (row.grossProfit < 0) {
    return (
      <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>
        <T en="Loss" ne="घाटा" />
      </span>
    );
  }

  return (
    <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>
      <T en="Healthy" ne="ठीक" />
    </span>
  );
}

function BatchStatusPill({ row }: { row: BatchCostingRow }) {
  if (row.missingCostMaterials.length > 0 || row.missingLaborStations.length > 0 || row.missingOverheadRate) {
    return (
      <span className={`${pill} border-amber-200 bg-amber-50 text-amber-800`}>
        <T en="Needs rate" ne="दर चाहियो" />
      </span>
    );
  }

  if (row.consumptionCount === 0) {
    return (
      <span className={`${pill} border-brand-green-line bg-brand-paper-deep text-brand-muted-deep`}>
        <T en="No usage" ne="खपत छैन" />
      </span>
    );
  }

  return (
    <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>
      <T en="Costed" ne="लागत निकालिएको" />
    </span>
  );
}

function FinishedStockSignalPill({ row }: { row: FinishedStockValuationRow }) {
  if (row.signal === "Needs cost") {
    return (
      <span className={`${pill} border-amber-200 bg-amber-50 text-amber-800`}>
        <T en="Needs cost" ne="लागत चाहियो" />
      </span>
    );
  }

  if (row.signal === "Needs price") {
    return (
      <span className={`${pill} border-orange-200 bg-orange-50 text-orange-800`}>
        <T en="Needs price" ne="मूल्य चाहियो" />
      </span>
    );
  }

  if (row.signal === "Loss risk") {
    return (
      <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>
        <T en="Loss risk" ne="घाटाको डर" />
      </span>
    );
  }

  if (row.signal === "No stock") {
    return (
      <span className={`${pill} border-brand-green-line bg-brand-paper-deep text-brand-muted-deep`}>
        <T en="No stock" ne="स्टक छैन" />
      </span>
    );
  }

  return (
    <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>
      <T en="Profit ready" ne="नाफा तयार" />
    </span>
  );
}

const CATALOG_SIGNAL: Record<string, { ne: string }> = {
  Matched: { ne: "मिलेको" },
  "No catalog product": { ne: "वेबसाइटमा जुत्ता छैन" },
  "No operations stock": { ne: "स्टकमा छैन" },
  "Catalog high": { ne: "वेबसाइटमा बढी" },
  "Catalog low": { ne: "वेबसाइटमा कम" },
};

function CatalogSyncPill({ row }: { row: CatalogStockReconciliationRow }) {
  const label = <T en={row.signal} ne={CATALOG_SIGNAL[row.signal]?.ne ?? row.signal} />;
  if (row.signal === "Matched") {
    return <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>{label}</span>;
  }

  if (row.signal === "No catalog product" || row.signal === "No operations stock") {
    return <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>{label}</span>;
  }

  return <span className={`${pill} border-amber-200 bg-amber-50 text-amber-800`}>{label}</span>;
}

/**
 * What a pair costs and what it earns (owner, 2026-10-12: the page was English
 * from top to bottom — "COGS", "Legacy batch cost model", "reconciliation" —
 * and nine parts one under another). Now in both languages, three figures
 * first, and the nine parts in four tabs: profit, shoes, material, rates.
 * Every table, figure and export is still here.
 */
export default async function AdminCostingPage() {
  const costing = await getCostingSnapshot();

  const allFigures = (
    <details className={sectionClass}>
      <summary className="cursor-pointer font-black text-brand-green-ink">
        <T en="All figures (12)" ne="सबै अंक (१२)" />
      </summary>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <StatCard
          label={<T en="Material purchase" ne="कच्चा माल खरिद" />}
          value={money(costing.summary.materialPurchaseCost)}
          detail={<T en={`${costing.summary.pricedMaterialCount} priced materials`} ne={`${costing.summary.pricedMaterialCount} कच्चा मालको दर छ`} />}
        />
        <StatCard
          label={<T en="Trading goods purchase" ne="बेच्नलाई किनेको माल" />}
          value={money(costing.summary.tradingGoodsPurchaseCost)}
          detail={<T en={`${costing.summary.tradingGoodsPurchasedPairs} pairs bought to resell`} ne={`बेच्नलाई किनेका ${costing.summary.tradingGoodsPurchasedPairs} जोडी`} />}
        />
        <StatCard
          label={<T en="Raw stock value" ne="कच्चा मालको मूल्य" />}
          value={money(costing.summary.rawMaterialStockValue)}
          detail={<T en={`${costing.summary.unpricedStockMaterialCount} unpriced stock items`} ne={`${costing.summary.unpricedStockMaterialCount} कच्चा मालको दर छैन`} />}
          tone={costing.summary.unpricedStockMaterialCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label={<T en="Low stock need" ne="कम भएको कच्चा माल" />}
          value={money(costing.summary.lowStockMaterialValue)}
          detail={<T en="estimated reorder value" ne="फेरि किन्ने अनुमानित मूल्य" />}
          tone={costing.summary.lowStockMaterialValue > 0 ? "warn" : "good"}
        />
        <StatCard
          label={<T en="Finished stock value" ne="तयार मालको मूल्य" />}
          value={money(costing.summary.finishedStockValue)}
          detail={<T en={`${costing.summary.finishedStockMissingCostCount} cost gaps`} ne={`${costing.summary.finishedStockMissingCostCount} को लागत छैन`} />}
          tone={costing.summary.finishedStockMissingCostCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label={<T en="Inventory profit" ne="स्टकको सम्भावित नाफा" />}
          value={money(costing.summary.finishedStockPotentialProfit)}
          detail={<T en={`${costing.summary.finishedStockMissingPriceCount} price gaps`} ne={`${costing.summary.finishedStockMissingPriceCount} को मूल्य छैन`} />}
          tone={costing.summary.finishedStockPotentialProfit >= 0 ? "good" : "danger"}
        />
        <StatCard
          label={<T en="Catalog mismatch" ne="वेबसाइटसँग नमिलेको" />}
          value={costing.summary.catalogStockMismatchCount}
          detail={<T en={`${costing.summary.catalogStockDeltaPairs} pair delta`} ne={`${costing.summary.catalogStockDeltaPairs} जोडी फरक`} />}
          tone={costing.summary.catalogStockMismatchCount > 0 ? "warn" : "good"}
        />
        <StatCard
          label={<T en="Labour cost" ne="ज्यालाको लागत" />}
          value={money(costing.summary.laborCost)}
          detail={<T en="worker task allocation" ne="कामदारको काम अनुसार" />}
          tone={costing.summary.laborCost > 0 ? "good" : "warn"}
        />
        <StatCard
          label={<T en="Overhead cost" ne="अरू खर्च" />}
          value={money(costing.summary.overheadCost)}
          detail={<T en={`${money(overheadPerPair(costing.settings))} per pair model`} ne={`जोडीमा ${money(overheadPerPair(costing.settings))}`} />}
          tone={costing.summary.overheadCost > 0 ? "good" : "warn"}
        />
        <StatCard
          label={<T en="Production cost" ne="उत्पादन लागत" />}
          value={money(costing.summary.productionCost)}
          detail={<T en="material + labour + overhead" ne="कच्चा माल + ज्याला + अरू खर्च" />}
        />
        <StatCard
          label={<T en="Sales revenue" ne="बिक्रीको आम्दानी" />}
          value={money(costing.summary.salesRevenue)}
          detail={<T en={`${costing.designCosting.length} designs tracked`} ne={`${costing.designCosting.length} जुत्ताको हिसाब`} />}
        />
        <StatCard
          label={<T en="Gross profit" ne="कुल नाफा" />}
          value={money(costing.summary.grossProfit)}
          detail={<T en={`${costing.summary.grossMarginRate}% margin`} ne={`${costing.summary.grossMarginRate}% नाफा`} />}
          tone={costing.summary.grossProfit >= 0 ? "good" : "danger"}
        />
      </div>
    </details>
  );

  const missingCostNote =
    costing.summary.missingCostDesigns > 0 ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
        <T
          en={`${costing.summary.missingCostDesigns} design rows need material, labour, or overhead rates before margin becomes fully accurate.`}
          ne={`${costing.summary.missingCostDesigns} जुत्ताको कच्चा माल, ज्याला वा अरू खर्चको दर चाहियो — त्यसपछि मात्र नाफा पूरा ठीक हुन्छ।`}
        />
      </div>
    ) : null;

  const profitPeriods = (
    <section className={sectionClass}>
      <div>
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Profit periods" ne="अवधि अनुसार नाफा" />
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          <T en="Daily, monthly, and yearly sales profit after estimated full cost." ne="अनुमानित पूरा लागत घटाएपछि दिन, महिना र वर्षको नाफा।" />
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {costing.periodReports.map((row) => (
          <div key={row.label} className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4">
            <p className="text-sm font-black text-brand-green-ink">
              <T en={row.label} ne={PERIOD[row.label]?.ne ?? row.label} />
            </p>
            <p className="mt-2 text-2xl font-black text-brand-green">{money(row.grossProfit)}</p>
            <p className="mt-1 text-xs font-semibold text-brand-muted">
              <T
                en={`Revenue ${money(row.revenue)} | Cost ${money(row.estimatedCogs)} | ${row.grossMarginRate}%`}
                ne={`आम्दानी ${money(row.revenue)} | लागत ${money(row.estimatedCogs)} | ${row.grossMarginRate}%`}
              />
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              <T en={`${row.netPairs} net pairs, ${row.returnedPairs} returned`} ne={`${row.netPairs} खुद जोडी, ${row.returnedPairs} फिर्ता`} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );

  const designProfit = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Profit by shoe" ne="जुत्ता अनुसार नाफा" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T en="Sales less the estimated cost of each pair." ne="बिक्रीबाट हरेक जोडीको अनुमानित लागत घटाएर।" />
          </p>
        </div>
        <Link href="/admin/pos" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Open POS" ne="बिल काट्ने पाना" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Design" ne="जुत्ता" />
              <Th en="Source" ne="कहाँबाट" />
              <Th en="Sold" ne="बिक्री" />
              <Th en="Revenue" ne="आम्दानी" />
              <Th en="Cost a pair" ne="जोडीको लागत" />
              <Th en="Est. cost" ne="अनुमानित लागत" />
              <Th en="Gross profit" ne="कुल नाफा" />
              <Th en="Margin" ne="नाफा %" />
              <Th en="Status" ne="अवस्था" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.designCosting.slice(0, 20).map((row) => (
              <tr key={row.design}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-bold text-brand-green-ink">{row.design}</p>
                  <p className="text-xs text-brand-muted">
                    <DesignPairsDetail row={row} />
                  </p>
                </td>
                <td data-label="Source" data-label-ne="कहाँबाट" className="py-3 pr-3">
                  <CostSourcePill source={row.costSource} />
                </td>
                <td data-label="Sold" data-label-ne="बिक्री" className="py-3 pr-3 text-brand-green-ink">
                  {row.netPairs}
                  {row.returnedPairs > 0 ? (
                    <span className="block text-xs text-brand-muted">
                      <T en={`${row.returnedPairs} returned`} ne={`${row.returnedPairs} फिर्ता`} />
                    </span>
                  ) : null}
                </td>
                <td data-label="Revenue" data-label-ne="आम्दानी" className="py-3 pr-3 font-semibold">{money(row.netRevenue)}</td>
                <td data-label="Cost a pair" data-label-ne="जोडीको लागत" className="py-3 pr-3">
                  {money(row.unitCostPerPair)}
                  <span className="block text-xs text-brand-muted">
                    <DesignCostBreakdown row={row} />
                  </span>
                </td>
                <td data-label="Est. cost" data-label-ne="अनुमानित लागत" className="py-3 pr-3">{money(row.estimatedCogs)}</td>
                <td data-label="Gross profit" data-label-ne="कुल नाफा" className="py-3 pr-3 font-black text-brand-green-ink">{money(row.grossProfit)}</td>
                <td data-label="Margin" data-label-ne="नाफा %" className="py-3 pr-3">{row.grossMarginRate}%</td>
                <td data-label="Status" data-label-ne="अवस्था" className="py-3 pr-3">
                  <StatusPill row={row} />
                </td>
              </tr>
            ))}
            {costing.designCosting.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={9}>
                  <T en="No design costing data yet." ne="जुत्ताको लागतको हिसाब अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const finishedStock = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Ready stock value" ne="तयार मालको मूल्य" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Ready stock valued at each shoe's cost a pair and its recent selling price."
              ne="तयार माल, हरेक जुत्ताको जोडीको लागत र हालको बिक्री मूल्यमा।"
            />
          </p>
        </div>
        <Link href="/admin/operations" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Open finished stock" ne="तयार माल हेर्ने" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Design" ne="जुत्ता" />
              <Th en="Channel" ne="माध्यम" />
              <Th en="Stock" ne="स्टक" />
              <Th en="Cost a pair" ne="जोडीको लागत" />
              <Th en="Avg sale" ne="औसत बिक्री" />
              <Th en="Stock value" ne="स्टकको मूल्य" />
              <Th en="Profit potential" ne="सम्भावित नाफा" />
              <Th en="Signal" ne="संकेत" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.finishedStockValuation.map((row) => (
              <tr key={row.stockId}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-bold text-brand-green-ink">{row.design}</p>
                  <p className="text-xs text-brand-muted">{row.sizeRun}</p>
                </td>
                <td data-label="Channel" data-label-ne="माध्यम" className="py-3 pr-3">
                  <T en={row.channel} ne={CHANNEL[row.channel]?.ne ?? row.channel} />
                </td>
                <td data-label="Stock" data-label-ne="स्टक" className="py-3 pr-3">
                  {row.stockPairs}
                  <span className="block text-xs text-brand-muted">
                    <T en={`Sold ${row.soldPairs}, return ${row.returnedPairs}`} ne={`बिक्री ${row.soldPairs}, फिर्ता ${row.returnedPairs}`} />
                  </span>
                </td>
                <td data-label="Cost a pair" data-label-ne="जोडीको लागत" className="py-3 pr-3">{money(row.unitCostPerPair)}</td>
                <td data-label="Avg sale" data-label-ne="औसत बिक्री" className="py-3 pr-3">
                  {money(row.averageSalePrice)}
                  <span className="block text-xs text-brand-muted">{row.priceSource}</span>
                </td>
                <td data-label="Stock value" data-label-ne="स्टकको मूल्य" className="py-3 pr-3 font-black text-brand-green-ink">{money(row.stockValue)}</td>
                <td data-label="Profit potential" data-label-ne="सम्भावित नाफा" className="py-3 pr-3">
                  <p className="font-bold text-brand-green">{money(row.potentialGrossProfit)}</p>
                  <p className="text-xs text-brand-muted">
                    <T
                      en={`Revenue ${money(row.potentialRevenue)} | ${row.potentialMarginRate}%`}
                      ne={`आम्दानी ${money(row.potentialRevenue)} | ${row.potentialMarginRate}%`}
                    />
                  </p>
                </td>
                <td data-label="Signal" data-label-ne="संकेत" className="py-3 pr-3">
                  <FinishedStockSignalPill row={row} />
                </td>
              </tr>
            ))}
            {costing.finishedStockValuation.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={8}>
                  <T en="No ready stock to value yet." ne="मूल्य निकाल्ने तयार माल अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const catalogMatch = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Website stock against the books" ne="वेबसाइटको स्टक र हिसाबको मिलान" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="The website's stock beside the ready stock, by shoe, code and product."
              ne="वेबसाइटमा देखिएको स्टक र तयार स्टक, जुत्ता, code र product अनुसार।"
            />
          </p>
        </div>
        <Link href="/admin/products" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Open products" ne="Products हेर्ने" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Website shoe" ne="वेबसाइटको जुत्ता" />
              <Th en="Stock name" ne="स्टकको नाम" />
              <Th en="Website stock" ne="वेबसाइटको स्टक" />
              <Th en="Ready stock" ne="तयार स्टक" />
              <Th en="Difference" ne="फरक" />
              <Th en="Channels" ne="माध्यम" />
              <Th en="Signal" ne="संकेत" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.catalogStockReconciliation.slice(0, 20).map((row) => (
              <tr key={row.key}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-bold text-brand-green-ink">{row.productName || "-"}</p>
                  <p className="text-xs text-brand-muted">
                    {row.sku || "-"} | {row.productStatus} | {money(row.catalogPrice)}
                  </p>
                </td>
                <td data-label="Stock name" data-label-ne="स्टकको नाम" className="py-3 pr-3 font-semibold text-brand-green-ink">{row.operationsDesign || "-"}</td>
                <td data-label="Website stock" data-label-ne="वेबसाइटको स्टक" className="py-3 pr-3">{row.catalogStock}</td>
                <td data-label="Ready stock" data-label-ne="तयार स्टक" className="py-3 pr-3">{row.operationsStockPairs}</td>
                <td data-label="Difference" data-label-ne="फरक" className="py-3 pr-3 font-black text-brand-clay">{row.stockDelta}</td>
                <td data-label="Channels" data-label-ne="माध्यम" className="max-w-64 py-3 pr-3 text-brand-muted">{row.channelBreakdown}</td>
                <td data-label="Signal" data-label-ne="संकेत" className="py-3 pr-3">
                  <CatalogSyncPill row={row} />
                </td>
              </tr>
            ))}
            {costing.catalogStockReconciliation.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={7}>
                  <T en="Nothing to compare yet." ne="मिलाउने केही अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const rawStock = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Raw material value" ne="कच्चा मालको मूल्य" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="What is left of each raw material, at the average price on the supplier bills."
              ne="हरेक कच्चा माल कति बाँकी छ, supplier का बिलको औसत मूल्यमा।"
            />
          </p>
        </div>
        <Link href="/admin/purchasing" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Update purchase rates" ne="खरिद दर मिलाउने" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Material" ne="कच्चा पदार्थ" />
              <Th en="Balance" ne="बाँकी" />
              <Th en="Avg cost" ne="औसत लागत" />
              <Th en="Stock value" ne="मूल्य" />
              <Th en="Reorder need" ne="फेरि किन्नुपर्ने" />
              <Th en="Signal" ne="संकेत" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.rawMaterialStockValuation.map((row) => (
              <tr key={row.materialId}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-bold text-brand-green-ink">{row.materialName}</p>
                  <p className="text-xs text-brand-muted">
                    <T en={`${row.invoiceCount} purchase invoices, ${row.unit}`} ne={`${row.invoiceCount} खरिद बिल, ${row.unit}`} />
                  </p>
                </td>
                <td data-label="Balance" data-label-ne="बाँकी" className="py-3 pr-3">
                  {rate(row.balance)}
                  <span className="block text-xs text-brand-muted">
                    <T en={`Reorder ${rate(row.reorderLevel)}`} ne={`फेरि किन्ने तह ${rate(row.reorderLevel)}`} />
                  </span>
                </td>
                <td data-label="Avg cost" data-label-ne="औसत लागत" className="py-3 pr-3">{money(row.averageUnitCost)}</td>
                <td data-label="Stock value" data-label-ne="मूल्य" className="py-3 pr-3 font-black text-brand-green-ink">{money(row.stockValue)}</td>
                <td data-label="Reorder need" data-label-ne="फेरि किन्नुपर्ने" className="py-3 pr-3">
                  {rate(row.reorderShortage)}
                  <span className="block text-xs text-brand-muted">{money(row.reorderValue)}</span>
                </td>
                <td data-label="Signal" data-label-ne="संकेत" className="py-3 pr-3">
                  {!row.hasPurchaseRate ? (
                    <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>
                      <T en="Rate missing" ne="दर छैन" />
                    </span>
                  ) : row.lowStock ? (
                    <span className={`${pill} border-amber-200 bg-amber-50 text-amber-800`}>
                      <T en="Reorder" ne="फेरि किन्ने" />
                    </span>
                  ) : (
                    <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-800`}>
                      <T en="Valued" ne="मूल्य निकालिएको" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {costing.rawMaterialStockValuation.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={6}>
                  <T en="No raw material stock to value yet." ne="मूल्य निकाल्ने कच्चा माल अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const batchCosting = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Cost of each lot" ne="हरेक lot को लागत" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T en="Raw material used and wasted, turned into each lot's cost." ne="खपत र खेर गएको कच्चा माल, हरेक lot को लागतमा।" />
          </p>
        </div>
        <Link href="/admin/operations" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Open operations" ne="उत्पादन र स्टक हेर्ने" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Batch" ne="lot" />
              <Th en="Status" ne="अवस्था" />
              <Th en="Finished" ne="तयार" />
              <Th en="Material" ne="कच्चा माल" />
              <Th en="Labour" ne="ज्याला" />
              <Th en="Overhead" ne="अरू खर्च" />
              <Th en="Total cost" ne="जम्मा लागत" />
              <Th en="Cost a pair" ne="जोडीको लागत" />
              <Th en="Signal" ne="संकेत" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.batchCosting.slice(0, 20).map((row) => (
              <tr key={row.batchId}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-mono text-xs font-bold text-brand-green-ink">{row.batchId}</p>
                  <p className="text-xs text-brand-muted">{row.design}</p>
                </td>
                <td data-label="Status" data-label-ne="अवस्था" className="py-3 pr-3">{row.status}</td>
                <td data-label="Finished" data-label-ne="तयार" className="py-3 pr-3">
                  {row.finishedPairs}/{row.plannedPairs}
                  {row.rejectedPairs > 0 ? (
                    <span className="block text-xs text-red-700">
                      <T en={`${row.rejectedPairs} rejected`} ne={`${row.rejectedPairs} बिग्रेको`} />
                    </span>
                  ) : null}
                </td>
                <td data-label="Material" data-label-ne="कच्चा माल" className="py-3 pr-3">{money(row.materialCost)}</td>
                <td data-label="Labour" data-label-ne="ज्याला" className="py-3 pr-3">{money(row.laborCost)}</td>
                <td data-label="Overhead" data-label-ne="अरू खर्च" className="py-3 pr-3">{money(row.overheadCost)}</td>
                <td data-label="Total cost" data-label-ne="जम्मा लागत" className="py-3 pr-3 font-semibold">{money(row.totalProductionCost)}</td>
                <td data-label="Cost a pair" data-label-ne="जोडीको लागत" className="py-3 pr-3">{money(row.unitCostPerPair)}</td>
                <td data-label="Signal" data-label-ne="संकेत" className="py-3 pr-3">
                  <BatchStatusPill row={row} />
                  {row.missingCostMaterials.length > 0 ? <p className="mt-1 text-xs text-brand-muted">{row.missingCostMaterials.join(", ")}</p> : null}
                  {row.missingLaborStations.length > 0 ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      <T en={`Labour: ${row.missingLaborStations.join(", ")}`} ne={`ज्याला: ${row.missingLaborStations.join(", ")}`} />
                    </p>
                  ) : null}
                  {row.missingOverheadRate ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      <T en="Overhead rate missing" ne="अरू खर्चको दर छैन" />
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
            {costing.batchCosting.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={9}>
                  <T en="No production lots yet." ne="उत्पादन lot अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const materialRates = (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Material prices" ne="कच्चा मालको दर" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T en="The average price from the purchase bills." ne="खरिद बिलबाट निकालेको औसत दर।" />
          </p>
        </div>
        <Link href="/admin/purchasing" className="text-sm font-bold text-brand-green underline underline-offset-4">
          <T en="Open purchasing" ne="खरिद हेर्ने" />
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <Th en="Material" ne="कच्चा पदार्थ" />
              <Th en="Qty" ne="परिमाण" />
              <Th en="Total" ne="जम्मा" />
              <Th en="Avg rate" ne="औसत दर" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costing.materialCostRates.map((row) => (
              <tr key={row.materialId || row.materialName}>
                <td className="reflow-primary py-3 pr-3">
                  <p className="font-bold text-brand-green-ink">{row.materialName}</p>
                  <p className="text-xs text-brand-muted">
                    <T en={`${row.invoiceCount} invoices, ${row.unit}`} ne={`${row.invoiceCount} बिल, ${row.unit}`} />
                  </p>
                </td>
                <td data-label="Qty" data-label-ne="परिमाण" className="py-3 pr-3">{rate(row.purchasedQuantity)}</td>
                <td data-label="Total" data-label-ne="जम्मा" className="py-3 pr-3 font-semibold">{money(row.purchaseTotal)}</td>
                <td data-label="Avg rate" data-label-ne="औसत दर" className="py-3 pr-3">{money(row.averageUnitCost)}</td>
              </tr>
            ))}
            {costing.materialCostRates.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-brand-muted" colSpan={4}>
                  <T en="No purchase rates yet." ne="खरिद दर अझै छैन।" />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );

  const rates = (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-emerald-950">
            <T en="Today's wage rates live in Wages & kharcha" ne="अहिलेका ज्याला दर ज्याला र खर्चमा छन्" />
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            <T
              en="The Upper, Fiber Preparation, Fiber Silai and Bottom Final rates are set there. The model below is kept for old lots only."
              ne="Upper, Fiber Preparation, Fiber Silai र Bottom Final का दर त्यहीँ राखिन्छन्। तलको हिसाब पुराना lot का लागि मात्र।"
            />
          </p>
        </div>
        <Link
          href="/admin/operations/production-accounts/rates"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand-green px-4 text-sm font-black text-white"
        >
          <T en="Open wage rates" ne="ज्याला दर खोल्ने" />
        </Link>
      </div>

      <details className="overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 font-black text-brand-green-ink marker:hidden">
          <T
            en="Old lot cost model — open only for old Cutting / Stitching / Sole Press records"
            ne="पुरानो lot को लागत हिसाब — पुराना Cutting / Stitching / Sole Press रेकर्डका लागि मात्र"
          />
        </summary>
        <EnterWalkForm action={updateCostingSettingsAction} className="border-t border-brand-green-line p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">
                <T en="Old lot cost model" ne="पुरानो lot को लागत हिसाब" />
              </h2>
              <p className="mt-1 text-sm text-brand-muted">
                <T
                  en="Kept only for old history. For today's work, use each item's materials and the Upper, Fiber Preparation, Fiber Silai and Bottom Final wage rates. Rent, electricity and salary can stay zero, as the factory works now."
                  ne="पुरानो इतिहासका लागि मात्र। अहिलेको कामका लागि हरेक सामानको कच्चा माल र Upper, Fiber Preparation, Fiber Silai, Bottom Final का ज्याला दर प्रयोग गर्नुहोस्। अहिलेको नियम अनुसार भाडा, बिजुली र तलब ० नै रहन सक्छन्।"
                />
              </p>
            </div>
            <FormSubmitButton className="h-10 rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
              <T en="Save cost model" ne="हिसाब राख्ने" />
            </FormSubmitButton>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">
                <T en="Labour per completed pair" ne="पूरा भएको जोडीमा ज्याला" />
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
                  <T en="Factory overhead" ne="कारखानाको अरू खर्च" />
                </p>
                <span className="rounded-full border border-brand-green-line px-3 py-1 text-xs font-black text-brand-green-ink">
                  <T en={`Comes to ${money(overheadPerPair(costing.settings))}/pair`} ne={`जोडीमा ${money(overheadPerPair(costing.settings))}`} />
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Factory overhead/pair" ne="कारखाना खर्च/जोडी" />
                  <input name="factoryOverheadPerPair" type="number" min="0" step="0.01" className={inputClass} defaultValue={costing.settings.factoryOverheadPerPair} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Electricity/pair" ne="बिजुली/जोडी" />
                  <input name="electricityPerPair" type="number" min="0" step="0.01" className={inputClass} defaultValue={costing.settings.electricityPerPair} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Rent/pair" ne="भाडा/जोडी" />
                  <input name="rentPerPair" type="number" min="0" step="0.01" className={inputClass} defaultValue={costing.settings.rentPerPair} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Misc./pair" ne="अरू/जोडी" />
                  <input name="miscellaneousPerPair" type="number" min="0" step="0.01" className={inputClass} defaultValue={costing.settings.miscellaneousPerPair} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Monthly fixed overhead" ne="महिनाको स्थिर खर्च" />
                  <input name="monthlyFixedOverhead" type="number" min="0" step="0.01" className={inputClass} defaultValue={costing.settings.monthlyFixedOverhead} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-brand-green-ink">
                  <T en="Monthly capacity pairs" ne="महिनामा बन्न सक्ने जोडी" />
                  <input name="monthlyCapacityPairs" type="number" min="1" step="1" className={inputClass} defaultValue={costing.settings.monthlyCapacityPairs} />
                </label>
              </div>
              <textarea
                aria-label="Cost model note"
                name="note"
                className={`${textareaClass} mt-3 w-full`}
                defaultValue={costing.settings.note}
                placeholder="Cost model note, salary basis, rent/electricity period, or approval reference."
              />
            </div>
          </div>
        </EnterWalkForm>
      </details>

      <details className={sectionClass}>
        <summary className="cursor-pointer font-black text-brand-green-ink">
          ⬇ <T en="Download as CSV (7)" ne="CSV मा डाउनलोड (७)" />
        </summary>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { type: "designs", en: "Shoes", ne: "जुत्ता" },
            { type: "materials", en: "Materials", ne: "कच्चा माल" },
            { type: "stock-valuation", en: "Raw material value", ne: "कच्चा मालको मूल्य" },
            { type: "finished-stock-value", en: "Ready stock value", ne: "तयार मालको मूल्य" },
            { type: "catalog-stock-sync", en: "Website against the books", ne: "वेबसाइट र हिसाब" },
            { type: "batches", en: "Lots", ne: "lot" },
            { type: "periods", en: "Periods", ne: "अवधि" },
          ].map((item) => (
            <ExportButton
              key={item.type}
              href={`/api/admin/costing/export?type=${item.type}`}
              className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
            >
              <T en={item.en} ne={item.ne} />
            </ExportButton>
          ))}
        </div>
      </details>
    </>
  );

  return (
    <section className="p-4 sm:p-6">
      <PageHead eyebrow={<T en="Cost and buying" ne="लागत र किनमेल" />} title={<T en="Costing" ne="लागत" />} />
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <T en="What a pair costs, what it earns, and what the stock is worth." ne="एक जोडीको लागत, त्यसको नाफा, र स्टकको मूल्य।" />
      </p>

      <div className="mt-4">
        <StatStrip
          items={[
            { en: "gross profit", ne: "कुल नाफा", value: costing.summary.grossProfit, money: true, tone: costing.summary.grossProfit < 0 ? "warn" : undefined },
            { en: "profit on sales", ne: "बिक्रीमा नाफा", value: `${costing.summary.grossMarginRate}%` },
            {
              en: "shoes with no cost",
              ne: "लागत नभएका जुत्ता",
              value: costing.summary.missingCostDesigns,
              tone: costing.summary.missingCostDesigns > 0 ? "warn" : "good",
            },
          ]}
        />
      </div>

      <div className="mt-5">
        <PageTabs
          id="costing"
          tabs={[
            {
              key: "profit",
              en: "💹 Profit",
              ne: "💹 नाफा",
              content: (
                <>
                  {missingCostNote}
                  {profitPeriods}
                  {designProfit}
                  {allFigures}
                </>
              ),
            },
            {
              key: "shoes",
              en: "👟 Shoes",
              ne: "👟 जुत्ता",
              content: (
                <>
                  {finishedStock}
                  {catalogMatch}
                </>
              ),
            },
            {
              key: "material",
              en: "🧵 Material",
              ne: "🧵 कच्चा माल",
              content: (
                <>
                  {rawStock}
                  {batchCosting}
                  {materialRates}
                </>
              ),
            },
            { key: "rates", en: "⚙️ Rates", ne: "⚙️ दर", content: rates },
          ]}
        />
      </div>
    </section>
  );
}
