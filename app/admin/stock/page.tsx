import CounterGoodsWatch, { weeklyCountShoes } from "@/app/admin/stock/CounterGoodsWatch";
import { getCounterItemsToWatch } from "@/lib/counter-items";
import { canAdmin, getSessionAdminRole } from "@/lib/admin-role-permissions";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import PrintButton from "@/components/admin/PrintButton";
import PrintedOn from "@/components/admin/PrintedOn";
import { businessContact } from "@/lib/seo";
import T from "@/components/T";
import LoadFailure from "@/components/admin/LoadFailure";
import { getOperationsData, type StockMovement } from "@/lib/operations";
import { movementKind, movementWords, readyParts, salesPace, type MovementKind } from "@/lib/stock-page-rules";
import { getCostingSnapshot } from "@/lib/costing";
import { money } from "@/lib/format-money";
import { getProducts } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { buildStockOverview, catalogStockWarnings, type ReadyStockOverviewRow, type ReadyStockOrigin } from "@/lib/stock-overview";
import { findDesignDrift, type DesignRecord } from "@/lib/design-drift";
import { outlookAdvice, stockOutlook } from "@/lib/stock-forecast";
import { getStockByPlace, getStockTransfers } from "@/lib/stock-transfers";
import { getAdminSession } from "@/lib/admin-auth";
import { NEPAL_TIME_ZONE, toBikramSambatNumeric } from "@/lib/bikram-sambat";
import WherePairsAre, { type ShoeExtra } from "@/app/admin/stock/WherePairsAre";

export const metadata = { title: "Stock Control | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function StatCard({ label, value, detail, tone = "plain", size = "normal" }: {
  label: ReactNode;
  value: string | number;
  detail: ReactNode;
  tone?: "plain" | "good" | "warn";
  /** "lead" for the one figure this screen is about — ready stock. The rest
   *  support it, and a row of equal numbers makes the reader find that out by
   *  reading all of them. */
  size?: "normal" | "lead";
}) {
  const valueTone = tone === "warn" ? "text-brand-clay" : tone === "good" ? "text-brand-green" : "text-brand-green-ink";
  // One step apart, matching the shared StatTile. Two steps stops reading as
  // the same kind of thing and starts reading as a banner.
  const valueSize = size === "lead" ? "text-5xl" : "text-3xl";
  // Same gradient accent the shared StatTile carries, so this page — which keeps
  // its own card only because its tones differ — still reads as one family.
  const accent =
    tone === "warn"
      ? "linear-gradient(90deg,#A9503F,#c86a5b)"
      : tone === "good"
        ? "linear-gradient(90deg,#12876a,#37c98c)"
        : "linear-gradient(90deg,#C8A04D,#E9C978)";
  return (
    <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-muted">{label}</p>
      <p className={`mt-2 font-display ${valueSize} font-black tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-brand-muted-soft">{detail}</p>
      <span className="mt-3 block h-1.5 rounded-full" style={{ background: accent }} />
    </div>
  );
}

const originStyle: Record<ReadyStockOrigin, { badge: string; panel: string; description: string }> = {
  Manufactured: {
    badge: "bg-emerald-100 text-emerald-800",
    panel: "border-emerald-200 bg-emerald-50/40",
    description: "Pairs completed by KRISHOE production and posted through Production In.",
  },
  Purchased: {
    badge: "bg-brand-green-wash text-brand-green",
    panel: "border-brand-green-line bg-brand-green-wash/40",
    description: "Ready-made pairs purchased from suppliers for resale.",
  },
  Mixed: {
    badge: "bg-amber-100 text-amber-900",
    panel: "border-amber-200 bg-amber-50/50",
    description: "This design has both factory-made and purchased inflow history.",
  },
  "Opening / Adjustment": {
    badge: "bg-brand-green-line text-brand-green-ink",
    panel: "border-brand-green-line bg-brand-paper-deep",
    description: "Opening or adjusted stock without a Production In or Purchase In source movement.",
  },
};

function ReadyStockSection({ title, origin, rows }: { title: string; origin: ReadyStockOrigin; rows: ReadyStockOverviewRow[] }) {
  const style = originStyle[origin];
  const total = rows.reduce((sum, row) => sum + row.stockPairs, 0);

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${style.panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style.badge}`}>{total} pairs</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">{style.description}</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-brand-muted">{rows.length} stock rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-brand-green-line bg-brand-paper/70 p-4 text-sm font-semibold text-brand-muted">
          <T en="No stock in this group." ne="यो समूहमा माल छैन।" />
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/80 bg-brand-paper p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">{row.design}</p>
                  <p className="mt-1 text-xs font-semibold text-brand-muted">{row.channel} · Size {row.sizeRun}</p>
                </div>
                <strong className="shrink-0 text-xl text-brand-green">{row.stockPairs}</strong>
              </div>
              <div className="mt-3 flex gap-4 border-t border-brand-green-line pt-3 text-xs font-semibold text-brand-muted">
                <span>Sold {row.soldPairs}</span>
                <span>Returned {row.returnedPairs}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function movementTone(type: MovementKind) {
  if (type === "Production In") return "bg-emerald-100 text-emerald-800";
  if (type === "Counter In") return "bg-[#E6EEF9] text-[#1F4E8C]";
  if (type === "Purchase In") return "bg-brand-green-wash text-brand-green";
  if (type === "Sale Out" || type === "Dispatch Out") return "bg-rose-100 text-rose-800";
  // A write-off is a loss, not a sale — amber so it stands out from routine
  // entries when the owner scans the movement list.
  if (type === "Damage Out") return "bg-amber-100 text-amber-900";
  return "bg-brand-mist text-brand-muted-deep";
}

// A movement's kind in the owner's words lives in lib/stock-page-rules.ts,
// shared with the tests: goods added at the counter read "added at the
// counter", not "adjusted".

/**
 * The recent movements, one line per shoe, per kind, per day — the owner's
 * sample, 2026-09-28: sixteen "Sale Out 1 pairs" lines were one shoe selling
 * through a day. The channel is left off: "Wholesale" on a bought-in shoe read
 * as a wholesale sale.
 */
function groupMovements(movements: StockMovement[]) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TIME_ZONE });
  const groups: Array<{ key: string; date: string; design: string; type: MovementKind; pairs: number; times: number; sizes: Set<string> }> = [];
  const byKey = new Map<string, (typeof groups)[number]>();
  for (const movement of movements) {
    const date = movement.createdAt ? day.format(new Date(movement.createdAt)) : "";
    const kind = movementKind(movement);
    const key = `${date}::${movement.design}::${kind}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, date, design: movement.design, type: kind, pairs: 0, times: 0, sizes: new Set() };
      byKey.set(key, group);
      groups.push(group);
    }
    group.pairs += movement.pairs;
    group.times += 1;
    if (movement.sizeRun && movement.sizeRun !== "Mixed") group.sizes.add(movement.sizeRun);
  }
  return groups;
}

async function loadStock(withCost: boolean) {
  try {
    const [products, operations, byPlace, transfers, costing] = await Promise.all([
      getProducts({ includeDrafts: true }),
      getOperationsData(),
      // Where the pairs are, and the challans that moved them. Read beside the
      // stock overview rather than inside it: this is a different question, and
      // a failure here must not cost the screen its stock figures.
      getStockByPlace().catch(() => []),
      getStockTransfers(40).catch(() => []),
      // What the ready pairs cost, for those who may read costing. Never
      // fatal: the page stands without the figure.
      withCost
        ? getCostingSnapshot().catch((error) => {
            reportError("load the stock value", error);
            return null;
          })
        : Promise.resolve(null),
    ]);
    const overview = buildStockOverview(operations, products);
    // Every design that holds pairs, collapsed across channels: the question
    // "when does this run out?" is about the shoe, not about which shelf it is
    // counted on.
    const pairsByDesign = new Map<string, number>();
    for (const row of operations.finishedStock) {
      pairsByDesign.set(row.design, (pairsByDesign.get(row.design) ?? 0) + row.stockPairs);
    }

    const extras: Record<string, ShoeExtra> = {};
    const originOf: Record<string, ShoeExtra["origin"]> = {
      Manufactured: "Made",
      Purchased: "Bought",
      Mixed: "Both",
      "Opening / Adjustment": "Other",
    };
    for (const row of [...overview.manufactured, ...overview.purchased, ...overview.mixed, ...overview.opening]) {
      const origin = originOf[row.origin] ?? "Other";
      const extra = extras[row.design] ?? { origin, sold: 0, lasts: null };
      if (extra.origin !== origin && origin !== "Other") extra.origin = extra.origin === "Other" ? origin : "Both";
      extra.sold += row.soldPairs;
      extras[row.design] = extra;
    }
    const outlook = stockOutlook(
      [...pairsByDesign].map(([design, pairs]) => ({ design, pairs })),
      operations.stockMovements,
    );
    for (const row of outlook) {
      const extra = extras[row.design] ?? { origin: "Other", sold: 0, lasts: null };
      extra.lasts =
        row.status !== "unknown"
          ? { status: row.status, ...outlookAdvice(row) }
          : row.soldInWindow === 0
            ? { status: "unknown", en: "No sales yet", ne: "बिक्री छैन" }
            : { status: "unknown", ...(salesPace(row.soldInWindow, row.historyDays) ?? { en: "Can't tell yet", ne: "भन्न मिल्दैन" }) };
      extras[row.design] = extra;
    }

    // The shoe's code, and its last ten movements worded, for the list.
    const codeByName = new Map<string, string>();
    const productIdByName = new Map<string, string>();
    for (const product of products) {
      if (product.sku && !codeByName.has(product.name)) codeByName.set(product.name, product.sku);
      if (!productIdByName.has(product.name)) productIdByName.set(product.name, product.id);
    }
    const latest = [...operations.stockMovements].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    for (const design of new Set([...Object.keys(extras), ...operations.finishedStock.map((row) => row.design)])) {
      const extra = extras[design] ?? { origin: "Other", sold: 0, lasts: null };
      extra.code = codeByName.get(design);
      extra.productId = productIdByName.get(design);
      extra.history = groupMovements(latest.filter((movement) => movement.design === design))
        .slice(0, 10)
        .map((entry) => {
          const words = movementWords[entry.type] ?? { en: entry.type, ne: entry.type, sign: 0 };
          return {
            date: entry.date ? toBikramSambatNumeric(entry.date) : "",
            en: `${words.en} · ${entry.times} time(s)`,
            ne: `${words.ne} · ${entry.times} पटक`,
            pairs: entry.pairs,
            sign: words.sign,
          };
        });
      extras[design] = extra;
    }

    return {
      overview,
      extras,
      byPlace,
      transfers,
      stockValue: costing
        ? {
            value: costing.summary.finishedStockValue,
            missingCost: costing.summary.finishedStockMissingCostCount,
          }
        : null,
      // Products the shop would sell that trace to no ready-stock pool — the
      // catalog number promising pairs the stock count cannot account for.
      catalogWarnings: catalogStockWarnings(products, operations.finishedStock),
      // Names close enough to be one shoe kept in two piles — the split that
      // once had the shop apologise for a pair it had. Questions, not verdicts.
      designDrift: findDesignDrift([
        ...products
          .filter((product) => product.status === "Active")
          .map((product): DesignRecord => ({
            name: product.name,
            where: "catalog",
            pairs: product.stock,
          })),
        ...operations.finishedStock.map((row): DesignRecord => ({
          name: row.design,
          where: "ready stock",
          pairs: row.stockPairs,
        })),
      ]),
      error: "",
    };
  } catch (error) {
    reportError("load unified stock control", error);
    return {
      overview: null,
      extras: {} as Record<string, ShoeExtra>,
      byPlace: [],
      transfers: [],
      stockValue: null,
      catalogWarnings: [],
      designDrift: [],
      error: saveFailureMessage(error, "Could not load stock control."),
    };
  }
}

export default async function AdminStockPage() {
  const session = await getAdminSession();
  const canCost = session ? canAdmin(getSessionAdminRole(session), "costing:read") : false;
  const [loaded, watch] = await Promise.all([
    loadStock(canCost),
    // Goods added at the counter: never fatal, the page stands without them.
    getCounterItemsToWatch().catch((error) => {
      reportError("load counter items to watch", error);
      return { toReview: [], billToCome: [] };
    }),
  ]);
  const canReview = session ? canAdmin(getSessionAdminRole(session), "settings:write") : false;
  // The day as this shop counts it, worked out on the server so the challan is
  // dated where the shop is rather than where the browser thinks it is.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TIME_ZONE }).format(new Date());
  if (!loaded.overview) return <LoadFailure what="stock control" message={loaded.error} retryHref="/admin/stock" />;
  const { summary, rawMaterials, manufactured, purchased, mixed, opening, recentMovements } = loaded.overview;
  const atFactory = loaded.byPlace.reduce((sum, row) => sum + row.factory, 0);
  const atShop = loaded.byPlace.reduce((sum, row) => sum + row.shop, 0);
  const toPutRight = loaded.byPlace.filter((row) => row.unplaced !== 0).length;
  const movementGroups = groupMovements(recentMovements);
  const parts = readyParts(summary);
  const partTone: Record<string, string> = { made: "bg-brand-green", bought: "bg-brand-gold-bright", both: "bg-emerald-300", shelf: "bg-[#5B84B8]" };

  return (
    // `report-print` carries the table header onto every sheet and stops rows
    // splitting across the fold — this is the list somebody walks the shelves
    // with, ticking off what is actually there.
    <section className="report-print p-4 sm:p-6">
      <div className="report-head flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Paper only — on screen the shop's name is already in the nav. */}
          <div className="mb-2 hidden border-b border-brand-green-line pb-2 print:block">
            <p className="text-base font-black uppercase tracking-[0.16em] text-brand-green-ink">KRISHOE</p>
            <p className="text-[11px] text-brand-muted">
              {businessContact.streetAddress}, {businessContact.addressLocality} · {businessContact.phoneDisplay}
            </p>
            <p className="mt-1 text-[11px] text-brand-muted">
              <T en="Printed" ne="छापिएको" />: <PrintedOn />
            </p>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
            <T en="One stock control" ne="मालको एउटै हिसाब" />
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink sm:text-3xl">
            <T en="Raw materials and ready goods" ne="कच्चा पदार्थ र बनिसकेको माल" />
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted print:hidden">
            <T
              en="How many pairs are ready to sell, where they are, and what the factory store holds."
              ne="बेच्न मिल्ने जोडी कति छन्, कहाँ छन्, र कारखानाको स्टोरमा के छ।"
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink">
            🖨️ <T en="Print" ne="छाप्ने" />
          </PrintButton>
          <Link href="/admin/purchasing" className="rounded-full border border-brand-green bg-brand-paper px-4 py-2 text-sm font-black text-brand-green"><T en="Receive purchase" ne="किनेको माल भित्र्याउने" /></Link>
          <Link href="/admin/operations" className="rounded-full bg-brand-green px-4 py-2 text-sm font-black text-white"><T en="Factory operations" ne="कारखानाको काम" /></Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* One number leads — the pairs that can be sold — then where they
            are, then how many shoes need putting right. The owner's sample:
            factory 144 and shop 60 do not make 215, and the old page left the
            reader to work out why from two paragraphs. */}
        {/* Every ready pair in one part, so the parts add up to the whole.
            "156 made here · 59 bought in" under 475 left 260 pairs
            unexplained (owner, 2026-09-30). */}
        <StatCard
          label={<T en="Pairs ready to sell" ne="बेच्न मिल्ने जोडी" />}
          value={summary.readyPairs}
          detail={
            <>
              {summary.readyPairs > 0 ? (
                <span className="mb-1.5 flex h-2.5 overflow-hidden rounded-full bg-brand-mist" aria-hidden="true">
                  {parts.map((part) => (
                    <span key={part.key} className={partTone[part.key]} style={{ width: `${(part.pairs / summary.readyPairs) * 100}%` }} />
                  ))}
                </span>
              ) : null}
              {parts.map((part, index) => (
                <span key={part.key} className="inline-flex items-center gap-1">
                  {index > 0 ? <span className="mx-1">·</span> : null}
                  <span className={`inline-block h-2 w-2 rounded-full ${partTone[part.key]}`} aria-hidden="true" />
                  <span className="tabular-nums">{part.pairs}</span> <T en={part.en} ne={part.ne} />
                </span>
              ))}
            </>
          }
          tone="good"
          size="lead"
        />
        <StatCard label={<T en="🏭 At the factory" ne="🏭 कारखानामा" />} value={atFactory} detail={<T en="Counted at the factory." ne="कारखानामा गनिएको।" />} />
        <StatCard label={<T en="🛒 At the shop" ne="🛒 पसलमा" />} value={atShop} detail={<T en="Counted at the shop." ne="पसलमा गनिएको।" />} />
        {toPutRight > 0 ? (
          <a href="#put-right" className="block rounded-2xl transition hover:-translate-y-0.5">
            <StatCard label={<T en="To put right" ne="मिलाउनुपर्ने" />} value={toPutRight} detail={<T en="Where the pairs sit does not match the stock. See below ↓" ne="ठाउँको गन्ती स्टकसँग मिलेन। तल हेर्नुहोस् ↓" />} tone="warn" />
          </a>
        ) : (
          <StatCard label={<T en="To put right" ne="मिलाउनुपर्ने" />} value={0} detail={<T en="Every pair has its place." ne="सबै जोडीको ठाउँ मिलेको छ।" />} tone="good" />
        )}
        {summary.rawMaterialReorderItems > 0 ? (
          <StatCard label={<T en="Material running low" ne="सकिन लागेको कच्चा माल" />} value={summary.rawMaterialReorderItems} detail={<T en={`Of ${summary.rawMaterialItems} materials.`} ne={`${summary.rawMaterialItems} वटा मालमध्ये।`} />} tone="warn" />
        ) : null}
        {loaded.stockValue ? (
          <StatCard
            label={<T en="Stock at cost" ne="स्टकको लागत मूल्य" />}
            value={money(loaded.stockValue.value)}
            detail={
              loaded.stockValue.missingCost > 0 ? (
                <T
                  en={`${loaded.stockValue.missingCost} shoe(s) have no cost yet and are not counted. Enter it in Costing.`}
                  ne={`${loaded.stockValue.missingCost} जुत्ताको लागत छैन, त्यसैले गनिएको छैन। Costing मा राख्नुहोस्।`}
                />
              ) : (
                <T en="Ready pairs at what each pair cost." ne="तयार जोडी, एक जोडीको लागतमा।" />
              )
            }
            tone={loaded.stockValue.missingCost > 0 ? "warn" : "plain"}
          />
        ) : null}
        {summary.damagedPairs > 0 ? (
          <StatCard label={<T en="Written off" ne="बिग्रिएर हटाएको" />} value={summary.damagedPairs} detail={<T en="Damaged or lost — not a sale." ne="बिग्रिएको वा हराएको — बिक्री होइन।" />} tone="warn" />
        ) : null}
      </div>

      <CounterGoodsWatch
        toReview={watch.toReview}
        billToCome={watch.billToCome}
        countThisWeek={weeklyCountShoes(loaded.byPlace, today)}
        canReview={canReview}
        today={today}
      />

      <WherePairsAre
        rows={loaded.byPlace}
        extras={loaded.extras}
        transfers={loaded.transfers}
        staffName={session?.name || session?.email || "Admin"}
        today={today}
        todayBs={toBikramSambatNumeric(today)}
      />

      {/* What a shopper can buy against what is ready. Only Active shoes are
          on sale: counting Drafts too, the page once said "the website shows
          the same 215 pairs" while the shop sold 96 of them (owner,
          2026-09-29). The question is asked only when the two numbers differ. */}
      {/* Shoes with pairs that shoppers cannot see, each a press from its
          form — the question below only named them in a sentence (owner,
          2026-09-30: 379 pairs apart). */}
      {summary.draftShoes.length > 0 ? (
        <section className="mt-4 rounded-2xl border-2 border-brand-gold/50 bg-brand-cream-soft p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T
              en={`Not on the website yet: ${summary.draftShoes.length} shoe(s), ${summary.draftCatalogPairs} pairs`}
              ne={`वेबसाइटमा अझै नदेखिएका: ${summary.draftShoes.length} जुत्ता, ${summary.draftCatalogPairs} जोडी`}
            />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T
              en="They are in Draft. Give each a price, a photo and its sizes, then make it Active to put it on sale."
              ne="यी Draft मा छन्। हरेकमा मूल्य, फोटो र साइज राखेर Active गरेपछि वेबसाइटमा बिक्रीमा आउँछन्।"
            />
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {summary.draftShoes.map((shoe) => (
              <li key={shoe.id}>
                <Link
                  href={`/admin/products?edit=${encodeURIComponent(shoe.id)}`}
                  className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 text-base"
                >
                  <span className="min-w-0">
                    <b className="text-brand-green-ink">{shoe.name}</b>
                    {shoe.sku ? <span className="ml-1 font-mono text-sm text-brand-muted">{shoe.sku}</span> : null}
                    <span className="ml-1 text-sm text-brand-muted">· {shoe.pairs} <T en="pairs" ne="जोडी" /></span>
                  </span>
                  <span className="shrink-0 text-sm font-black text-brand-green">
                    <T en="Put on sale →" ne="बिक्रीमा राख्ने →" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.onSaleCatalogPairs === summary.readyPairs ? (
        <p className="mt-4 rounded-2xl border border-brand-green-line bg-brand-green-wash px-4 py-3 text-sm font-bold leading-6 text-brand-green-ink">
          ✓{" "}
          <T
            en={`All ${summary.onSaleCatalogPairs} ready pairs are on sale on the website.`}
            ne={`तयार भएका सबै ${summary.onSaleCatalogPairs} जोडी वेबसाइटमा बिक्रीमा छन्।`}
          />
        </p>
      ) : (
        <details className="mt-4 rounded-2xl border border-brand-gold/40 bg-brand-cream-soft px-4 py-3 text-sm leading-6 text-brand-green-ink">
          <summary className="cursor-pointer font-bold">
            <T
              en={`On sale on the website: ${summary.onSaleCatalogPairs} pairs, ready in stock: ${summary.readyPairs} — why ${Math.abs(summary.readyPairs - summary.onSaleCatalogPairs)} pairs apart?`}
              ne={`वेबसाइटमा बिक्रीमा ${summary.onSaleCatalogPairs} जोडी, स्टकमा तयार ${summary.readyPairs} — ${Math.abs(summary.readyPairs - summary.onSaleCatalogPairs)} जोडी फरक किन?`}
            />
          </summary>
          {summary.draftCatalogPairs > 0 ? (
            <p className="mt-2 font-bold">
              <T
                en={`${summary.draftCatalogPairs} pairs are on shoes still in Draft, which shoppers cannot see: ${summary.draftShoesWithPairs.join(", ")}. Make them Active in Products to put them on sale.`}
                ne={`${summary.draftCatalogPairs} जोडी Draft मा रहेका जुत्ताका हुन्, जुन ग्राहकले देख्दैनन्: ${summary.draftShoesWithPairs.join(", ")}। बेच्न Products मा गएर Active गर्नुहोस्।`}
              />{" "}
              <Link href="/admin/products" className="text-brand-green underline">
                <T en="Products →" ne="Products →" />
              </Link>
            </p>
          ) : null}
          <p className="mt-2">
            <T
              en={`The website is the selling view of the same ready pairs, not another store — do not add the two together. They part when a shoe with ready pairs is not on the website yet, or when the website shows pairs for a shoe the stock does not know — those are listed below. The website has ${summary.catalogDesigns} shoes.`}
              ne={`वेबसाइटले यिनै तयार जोडी बेच्न देखाउँछ, यो छुट्टै गोदाम होइन, त्यसैले दुई अंक जोड्नु हुँदैन। फरक तब पर्छ जब तयार जोडी भएको जुत्ता वेबसाइटमा राखिएको हुँदैन, वा वेबसाइटले स्टकमा नभेटिने जुत्ताको जोडी देखाउँछ; त्यस्ता जुत्ता तल देखिन्छन्। वेबसाइटमा ${summary.catalogDesigns} जुत्ता छन्।`}
            />
          </p>
        </details>
      )}

      {loaded.catalogWarnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-rose-900">
                <T
                  en="Website stock with no factory or purchase behind it"
                  ne="कारखाना वा किनाइको आधार नभएको वेबसाइट स्टक"
                />
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-rose-800">
                <T
                  en="The shop is selling these, but their pairs trace to no production or purchase — so the count promises stock the factory cannot account for. This is the drift that can make the shop show a shoe it may not have. Make or receive the pairs (log Production In / Purchase In), or take the website stock down."
                  ne="पसलले यी बेचिरहेको छ, तर यिनका जोडी कुनै उत्पादन वा किनाइसँग मिल्दैनन् — त्यसैले संख्याले नभएको स्टकको वाचा गर्छ। यही फरकले पसलमा नभएको जुत्ता देखाउन सक्छ। जोडी बनाउनुहोस् वा भित्र्याउनुहोस् (Production In / Purchase In टिप्नुहोस्), वा वेबसाइट स्टक घटाउनुहोस्।"
                />
              </p>
            </div>
            <span className="inline-flex rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-black text-rose-800">
              {loaded.catalogWarnings.length}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {loaded.catalogWarnings.map((warning) => (
              <div
                key={warning.productId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">{warning.productName}</p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-muted">
                    {warning.sku ? `${warning.sku} · ` : ""}
                    <T
                      en={`${warning.websiteStock} pairs on the website · 0 in ready stock`}
                      ne={`वेबसाइटमा ${warning.websiteStock} जोडी · तयारी स्टकमा ०`}
                    />
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin/operations"
                    className="rounded-full bg-brand-green px-3 py-1.5 text-xs font-black text-white"
                  >
                    <T en="Log stock" ne="स्टक टिप्ने" />
                  </Link>
                  <Link
                    href={`/admin/products?edit=${encodeURIComponent(warning.productId)}`}
                    className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-black text-rose-800"
                  >
                    <T en="Edit product" ne="सामान मिलाउने" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Amber, not red: nothing here is known to be wrong. Each row is a
          question only the owner can answer — is this one shoe or two? */}
      {loaded.designDrift.length > 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-amber-900">
                <T
                  en="Two names that may be one shoe"
                  ne="एउटै जुत्ताका दुई नाम हुन सक्ने"
                />
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-900">
                <T
                  en="These names are close enough that they may be the same shoe kept in two piles — which is how the shop once apologised for a pair it actually had. Nothing has been changed. If two names are one shoe, move the pairs onto the name you keep and retire the other; if they are genuinely different shoes, leave them."
                  ne="यी नामहरू यति मिल्दा छन् कि एउटै जुत्ता दुई थाकमा राखिएको हुन सक्छ — यही कारण पसलले आफूसँग भएकै जुत्ताको लागि माफी मागेको थियो। केही पनि बदलिएको छैन। दुई नाम एउटै जुत्ता हो भने, राख्ने नाममा जोडी सार्नुहोस् र अर्को बन्द गर्नुहोस्; साँच्चै फरक जुत्ता हो भने छाडिदिनुहोस्।"
                />
              </p>
            </div>
            <span className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-black text-amber-900">
              {loaded.designDrift.length}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {loaded.designDrift.map((drift) => (
              <div
                key={`${drift.left.name}::${drift.right.name}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="font-black text-brand-green-ink">
                    <span className="truncate">{drift.left.name}</span>
                    <span className="mx-2 text-amber-700">·</span>
                    <span className="truncate">{drift.right.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-muted">
                    <T
                      en={`${drift.left.pairs} pairs in ${drift.left.where} · ${drift.right.pairs} pairs in ${drift.right.where}`}
                      ne={`${drift.left.pairs} जोडी (${drift.left.where === "catalog" ? "सामान सूची" : "तयारी स्टक"}) · ${drift.right.pairs} जोडी (${drift.right.where === "catalog" ? "सामान सूची" : "तयारी स्टक"})`}
                    />
                  </p>
                </div>
                <Link
                  href="/admin/operations"
                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-900"
                >
                  <T en="Open stock" ne="स्टक खोल्ने" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Recent stock movement" ne="पछिल्लो चलखेल" />
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          <T en="One line per shoe, per kind, per day." ne="एक दिनमा एउटा जुत्ताको एउटा लाइन।" />
        </p>
        <div className="mt-4 grid max-h-[420px] gap-1.5 overflow-auto pr-1">
          {movementGroups.length === 0 ? (
            <p className="rounded-xl bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
              <T en="No stock movement recorded." ne="कुनै चलखेल टिपिएको छैन।" />
            </p>
          ) : (
            movementGroups.map((group, index) => {
              const words = movementWords[group.type] ?? { en: group.type, ne: group.type, sign: 0 };
              const newDay = index === 0 || movementGroups[index - 1].date !== group.date;
              const sizes = [...group.sizes];
              return (
                <Fragment key={group.key}>
                  {newDay && group.date ? (
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-brand-muted-soft first:mt-0">
                      {toBikramSambatNumeric(group.date)}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-green-line bg-brand-paper-deep px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-brand-green-ink">
                        {group.design} · <T en={words.en} ne={words.ne} />
                      </p>
                      <p className="text-xs text-brand-muted">
                        <T en={`${group.times} time(s)`} ne={`${group.times} पटक`} />
                        {sizes.length ? ` · ${sizes.length > 3 ? `${sizes.length} sizes` : sizes.join(", ")}` : ""}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-sm font-black tabular-nums ${movementTone(group.type)}`}>
                      {words.sign > 0 ? "+" : words.sign < 0 ? "−" : ""}
                      {group.pairs}
                    </span>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Raw material store" ne="कच्चा पदार्थको भण्डार" />
          </h2>
          <Link href="/admin/operations" className="text-sm font-black text-brand-green underline"><T en="Manage materials" ne="कच्चा पदार्थ मिलाउने" /></Link>
        </div>
        {rawMaterials.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">
            <T en="No raw material yet — it comes in on a purchase bill." ne="कच्चा माल अहिले छैन — खरिद बिलबाट चढाउनुहोस्।" />{" "}
            <Link href="/admin/purchasing" className="font-bold text-brand-green underline"><T en="Purchase bill" ne="खरिद बिल" /></Link>
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-brand-muted">
              <T en="On hand = opening + received − used." ne="बाँकी = सुरुको + भित्रिएको − खर्च भएको।" />
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {rawMaterials.map((material) => (
                <div key={material.id} className={`rounded-xl border p-4 ${material.needsReorder ? "border-rose-200 bg-rose-50" : "border-brand-green-line bg-brand-paper-deep"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-brand-green-ink">{material.name}</p>
                      <p className="mt-1 text-xs font-semibold text-brand-muted">Reorder at {material.reorderLevel} {material.unit}</p>
                    </div>
                    <p className={`text-lg font-black ${material.needsReorder ? "text-rose-700" : "text-brand-green"}`}>{material.onHand} <span className="text-xs">{material.unit}</span></p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-brand-muted">Received {material.received} · Used {material.used}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Only when where-the-pairs-are could not load: then these are the one
          list of ready stock the page can still show. */}
      {loaded.byPlace.length === 0 ? (
        <div className="mt-6 grid gap-4">
          <ReadyStockSection title="KRISHOE manufactured stock" origin="Manufactured" rows={manufactured} />
          <ReadyStockSection title="Purchased ready goods for resale" origin="Purchased" rows={purchased} />
          {mixed.length > 0 ? <ReadyStockSection title="Mixed-source designs" origin="Mixed" rows={mixed} /> : null}
          {opening.length > 0 ? <ReadyStockSection title="Opening or adjusted stock" origin="Opening / Adjustment" rows={opening} /> : null}
        </div>
      ) : null}
    </section>
  );
}
