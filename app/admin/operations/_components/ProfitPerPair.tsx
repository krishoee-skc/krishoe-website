import T from "@/components/T";
import { money } from "@/lib/format-money";
import type { OperationsCostingSnapshot } from "@/app/admin/operations/_components/types";

/**
 * What one pair of each shoe costs, sells for, and leaves.
 *
 * The finished-stock table gave totals only — value Rs. 10,875, profit
 * Rs. 394 — and the one figure that decides a price was left to mental
 * arithmetic: eva fab left about Rs. 14 a pair (owner, 2026-09-29). One line
 * per shoe, in colour: green is a healthy margin, gold is thin, red is almost
 * nothing.
 */
export type PairProfitRow = {
  design: string;
  stockPairs: number;
  unitCost: number;
  salePrice: number;
  profit: number | null;
  labourOnly: boolean;
};

export function pairProfitRows(costing: OperationsCostingSnapshot): PairProfitRow[] {
  const byShoe = new Map<string, PairProfitRow>();
  for (const row of costing.finishedStockValuation) {
    const key = row.design.trim().toLowerCase();
    const seen = byShoe.get(key);
    if (seen) {
      seen.stockPairs += row.stockPairs;
      seen.labourOnly = seen.labourOnly || row.labourOnly;
      continue;
    }
    byShoe.set(key, {
      design: row.design,
      stockPairs: row.stockPairs,
      unitCost: row.unitCostPerPair,
      salePrice: row.averageSalePrice,
      profit: row.unitCostPerPair > 0 && row.averageSalePrice > 0 ? row.averageSalePrice - row.unitCostPerPair : null,
      labourOnly: row.labourOnly,
    });
  }
  return [...byShoe.values()]
    .filter((row) => row.stockPairs > 0)
    .sort((left, right) => (left.profit ?? Infinity) - (right.profit ?? Infinity));
}

/** Thin below 10% of the price, healthy from 25%. */
export function marginTone(row: Pick<PairProfitRow, "profit" | "salePrice">): "bad" | "thin" | "good" | "none" {
  if (row.profit === null || row.salePrice <= 0) return "none";
  const rate = row.profit / row.salePrice;
  if (rate < 0.1) return "bad";
  if (rate < 0.25) return "thin";
  return "good";
}

const toneClass = {
  bad: "bg-brand-clay-tint text-brand-clay",
  thin: "bg-brand-cream-soft text-brand-gold-ink",
  good: "bg-brand-green-wash text-brand-green",
  none: "text-brand-muted",
} as const;

export default function ProfitPerPair({ rows }: { rows: PairProfitRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <h2 className="text-xl font-black text-brand-green-ink">
        <T en="Profit on one pair" ne="एक जोडीमा नाफा" />
      </h2>
      <p className="mt-1 text-base text-brand-muted">
        <T
          en="Cost and average selling price per pair, for each shoe in stock. Red is almost no profit."
          ne="स्टकमा भएका हरेक जुत्ताको एक जोडीको लागत र औसत बिक्री मूल्य। रातो भनेको झन्डै नाफा नभएको।"
        />
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="reflow-table min-w-full text-base">
          <thead className="border-b text-left text-sm text-brand-muted">
            <tr>
              <th className="py-2 pr-3"><T en="Shoe" ne="जुत्ता" /></th>
              <th className="py-2 pr-3 text-right"><T en="Stock" ne="स्टक" /></th>
              <th className="py-2 pr-3 text-right"><T en="Cost / pair" ne="लागत / जोडी" /></th>
              <th className="py-2 pr-3 text-right"><T en="Sells at" ne="बिक्री मूल्य" /></th>
              <th className="py-2 pr-3 text-right"><T en="Profit / pair" ne="नाफा / जोडी" /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const tone = marginTone(row);
              return (
                <tr key={row.design}>
                  <td className="reflow-primary py-2.5 pr-3 font-bold text-brand-green-ink">{row.design}</td>
                  <td data-label="Stock" data-label-ne="स्टक" className="py-2.5 pr-3 text-right tabular-nums">{row.stockPairs}</td>
                  <td data-label="Cost / pair" data-label-ne="लागत / जोडी" className="py-2.5 pr-3 text-right tabular-nums">
                    {row.unitCost > 0 ? money(row.unitCost) : <span className="font-bold text-brand-clay"><T en="No cost" ne="लागत छैन" /></span>}
                    {row.labourOnly ? (
                      <span className="block text-sm font-bold text-brand-gold-ink"><T en="⚠ labour only" ne="⚠ ज्याला मात्र" /></span>
                    ) : null}
                  </td>
                  <td data-label="Sells at" data-label-ne="बिक्री मूल्य" className="py-2.5 pr-3 text-right tabular-nums">
                    {row.salePrice > 0 ? money(Math.round(row.salePrice)) : <span className="text-brand-muted"><T en="No price" ne="मूल्य छैन" /></span>}
                  </td>
                  <td data-label="Profit / pair" data-label-ne="नाफा / जोडी" className="py-2.5 pr-3 text-right">
                    <span className={`inline-block rounded-full px-3 py-0.5 font-black tabular-nums ${toneClass[tone]}`}>
                      {row.profit === null ? "—" : money(Math.round(row.profit))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
