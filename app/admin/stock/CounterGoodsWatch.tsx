import Link from "next/link";
import T from "@/components/T";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import { money } from "@/lib/format-money";
import type { CounterItemRow, StockToFillRow } from "@/lib/counter-items";
import { STOCK_TO_FILL_DAYS } from "@/lib/counter-item-rules";
import FillByCount from "@/app/admin/stock/FillByCount";
import type { StockAtPlace } from "@/lib/stock-transfers";
import { markCounterItemReviewedAction } from "@/app/admin/stock/actions";
import ReviewButton from "@/app/admin/stock/ReviewButton";
import { sizesToCount } from "@/lib/stock-page-rules";

const HOW = {
  old: { en: "Already on the shelf", ne: "पहिले नै थियो" },
  pending_bill: { en: "Bill to come", ne: "बिल आउन बाँकी" },
  factory: { en: "Made here", ne: "कारखानाको" },
} as const;

/**
 * Five shoes to count this week, turn by turn through everything in stock.
 *
 * Counts drift quietly — a pair sold without a bill, a pair put on the wrong
 * shelf — and nobody knows until a customer is told "we have it" for a pair
 * that is not there (owner, 2026-09-29). Five a week is a few minutes' walk,
 * and by the end of a few weeks every shoe has been looked at. The same five
 * all week, so the list does not change under the person counting.
 */
export function weeklyCountShoes(rows: StockAtPlace[], today: string, howMany = 5) {
  const byShoe = new Map<
    string,
    { design: string; factory: number; shop: number; total: number; rows: StockAtPlace[]; sizes: Array<{ size: string; pairs: number }> }
  >();
  for (const row of rows) {
    const key = row.design.trim().toLowerCase();
    const seen = byShoe.get(key) ?? { design: row.design, factory: 0, shop: 0, total: 0, rows: [], sizes: [] };
    seen.factory += row.factory;
    seen.shop += row.shop;
    seen.total += row.total;
    seen.rows.push(row);
    byShoe.set(key, seen);
  }
  // A big shoe is counted size by size: "count 200 pairs of kitto 770" is a
  // morning's work and hides a wrong number (owner, 2026-09-30).
  for (const shoe of byShoe.values()) shoe.sizes = sizesToCount(shoe.rows, shoe.total);
  const inStock = [...byShoe.values()]
    .filter((shoe) => shoe.total > 0)
    .sort((a, b) => a.design.localeCompare(b.design))
    .map(({ design, factory, shop, total, sizes }) => ({ design, factory, shop, total, sizes }));
  if (inStock.length <= howMany) return inStock;
  // Weeks from Sunday, the shop's week. Day 0 (1 Jan 1970) was a Thursday, so
  // four days are added before dividing, or the list would change on Thursdays.
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / (24 * 60 * 60 * 1000));
  const week = Math.floor((day + 4) / 7);
  const start = (week * howMany) % inStock.length;
  return Array.from({ length: howMany }, (_, index) => inStock[(start + index) % inStock.length]);
}

/**
 * What the Owner keeps an eye on after goods are added from the counter bill:
 * each new item until it is looked at, each "bill to come" until the bill
 * arrives, and this week's five shoes to count.
 */
export default function CounterGoodsWatch({
  toReview,
  billToCome,
  stockToFill = [],
  countThisWeek,
  canReview,
  today,
}: {
  toReview: CounterItemRow[];
  billToCome: CounterItemRow[];
  stockToFill?: StockToFillRow[];
  countThisWeek: ReturnType<typeof weeklyCountShoes>;
  canReview: boolean;
  today: string;
}) {
  const todayTime = Date.parse(`${today}T12:00:00Z`);
  const daysSince = (iso: string) => Math.max(0, Math.floor((todayTime - Date.parse(iso)) / (24 * 60 * 60 * 1000)));

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2 print:hidden">
      {toReview.length > 0 ? (
        <section id="new-goods" className="scroll-mt-24 rounded-2xl border-2 border-brand-gold/60 bg-brand-cream-soft p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en={`New goods added at the counter (${toReview.length})`} ne={`बिल काट्ने पेजबाट थपिएका नयाँ माल (${toReview.length})`} />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Check the name, pairs and price of each. ✓ takes it off this list."
              ne="हरेकको नाम, जोडी र मूल्य हेर्नुहोस्। ✓ थिच्दा यो सूचीबाट हट्छ।"
            />
          </p>
          <ul className="mt-3 grid gap-2">
            {toReview.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
                <div className="min-w-0 text-base">
                  <p className="font-black text-brand-green-ink">{item.design}</p>
                  <p className="text-sm text-brand-muted">
                    {item.pairs} <T en="pairs" ne="जोडी" /> · {money(item.retailPrice)} ·{" "}
                    {item.costPerPair > 0 ? (
                      <T en={`cost ${money(item.costPerPair)}`} ne={`लागत ${money(item.costPerPair)}`} />
                    ) : (
                      <span className="font-bold text-brand-gold-ink"><T en="cost to come" ne="लागत बाँकी" /></span>
                    )}{" "}
                    · <T en={HOW[item.how].en} ne={HOW[item.how].ne} />
                    {item.createdBy ? ` · ${item.createdBy}` : ""} · <DateDisplayAdmin date={item.createdAt} time />
                  </p>
                </div>
                {canReview ? (
                  <form action={markCounterItemReviewedAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <ReviewButton />
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Sold at the counter before the stock was put in (owner, 2026-10-09):
          filled from the purchase bill, or by counting the shelf. Seven days
          is the Owner's limit before the dashboard asks. */}
      {stockToFill.length > 0 ? (
        <section id="stock-to-fill" className="scroll-mt-24 rounded-2xl border-2 border-brand-gold/60 bg-brand-cream-soft p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en={`Sold first — stock to fill (${stockToFill.length})`} ne={`पहिले बेचेको — स्टक भर्न बाँकी (${stockToFill.length})`} />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Sold at the counter before their pairs were put in. Fill each from its purchase bill (choose it there; type every pair on the bill), or count the shelf here."
              ne="पसलमा जोडी नचढाई काउन्टरमा बेचिएका। हरेकको स्टक खरिद बिलबाट भर्नुहोस् (त्यहाँ यही माल छानेर बिलका सबै जोडी लेख्ने), वा यहीँ र्‍याकमा गनेर भर्नुहोस्।"
            />
          </p>
          <ul className="mt-3 grid gap-2">
            {stockToFill.map((item) => {
              const days = daysSince(item.createdAt);
              const late = days >= STOCK_TO_FILL_DAYS;
              const sold = Object.entries(item.soldSizes).map(([size, pairs]) => `${size}×${pairs}`).join(", ");
              return (
                <li key={item.id} className="grid gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 text-base">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <b className="text-brand-green-ink">{item.design}</b> ·{" "}
                      <T en={`${item.soldPairs} sold`} ne={`${item.soldPairs} जोडी बिकेको`} />
                      {sold ? <span className="text-sm text-brand-muted"> ({sold})</span> : null}
                    </span>
                    <span className={`rounded-full px-3 py-0.5 text-sm font-black ${late ? "bg-brand-clay-tint text-brand-clay" : "bg-brand-cream-soft text-brand-gold-ink"}`}>
                      <T en={`${days} days waiting`} ne={`${days} दिन भयो`} />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href="/admin/purchasing" className="inline-flex min-h-11 items-center rounded-full border border-brand-green px-4 text-sm font-black text-brand-green">
                      <T en="Fill from its purchase bill →" ne="खरिद बिलबाट भर्ने →" />
                    </Link>
                  </div>
                  <details className="rounded-xl border border-dashed border-brand-green-line px-3 py-2">
                    <summary className="cursor-pointer text-sm font-black text-brand-green">
                      <T en="Or count the shelf" ne="वा र्‍याकमा गनेर भर्ने" />
                    </summary>
                    <FillByCount id={item.id} design={item.design} />
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {billToCome.length > 0 ? (
        <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en={`Bill to come (${billToCome.length})`} ne={`बिल आउन बाँकी (${billToCome.length})`} />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="These pairs are in stock and selling; their supplier's bill has not come. When it does, enter it on the purchase bill and mark it there as this item — the pairs are not added twice."
              ne="यी जोडी स्टकमा छन् र बिकिरहेका छन्, तर साहुको बिल आएको छैन। बिल आएपछि खरिद बिलमा चढाउँदा यही माल हो भनेर छान्नुहोस्, जोडी दोहोरो चढ्दैनन्।"
            />
          </p>
          <ul className="mt-3 grid gap-2">
            {billToCome.map((item) => {
              const days = daysSince(item.createdAt);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green-line px-3 py-2 text-base">
                  <span>
                    <b className="text-brand-green-ink">{item.design}</b> · {item.pairs} <T en="pairs" ne="जोडी" />
                    {item.supplierName ? ` · ${item.supplierName}` : ""}
                  </span>
                  <span className={`rounded-full px-3 py-0.5 text-sm font-black ${days >= 7 ? "bg-brand-clay-tint text-brand-clay" : "bg-brand-cream-soft text-brand-gold-ink"}`}>
                    <T en={`${days} days waiting`} ne={`${days} दिन भयो`} />
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/purchasing" className="mt-3 inline-flex min-h-11 items-center rounded-full border border-brand-green px-4 text-sm font-black text-brand-green">
            <T en="Enter a purchase bill →" ne="खरिद बिल चढाउने →" />
          </Link>
        </section>
      ) : null}

      {countThisWeek.length > 0 ? (
        <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="This week, count these on the shelf" ne="यो हप्ता र्‍याकमा यी गन्नुहोस्" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="Five shoes a week, turn by turn. If the shelf differs from the app, put the count in with “Count pairs in” below."
              ne="हप्तामा ५ जुत्ता, पालैपालो। र्‍याक र एप फरक परे तलको “गनेर ठाउँ राख्ने” मा गन्ती राख्नुहोस्।"
            />
          </p>
          <ul className="mt-3 grid gap-1.5">
            {countThisWeek.map((shoe) => (
              <li key={shoe.design} className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-brand-green-line py-1.5 text-base last:border-b-0">
                <b className="text-brand-green-ink">{shoe.design}</b>
                <span className="text-sm text-brand-muted">
                  <T
                    en={`App: ${shoe.total} · shop ${shoe.shop} · factory ${shoe.factory} · shelf: ____`}
                    ne={`एपमा ${shoe.total} · पसल ${shoe.shop} · कारखाना ${shoe.factory} · र्‍याकमा: ____`}
                  />
                </span>
                {shoe.sizes.length > 0 ? (
                  <span className="grid w-full grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5 pt-1">
                    {shoe.sizes.map((entry) => (
                      <span key={entry.size} className="rounded-lg border border-brand-green-line px-2 py-1 text-sm tabular-nums text-brand-green-ink">
                        {entry.size === "Mixed" ? (
                          <T en={`Uncounted: ${entry.pairs} · shelf ___`} ne={`साइज नगनिएको: ${entry.pairs} · र्‍याक ___`} />
                        ) : (
                          <T en={`Size ${entry.size}: ${entry.pairs} · shelf ___`} ne={`साइज ${entry.size}: ${entry.pairs} · र्‍याक ___`} />
                        )}
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
