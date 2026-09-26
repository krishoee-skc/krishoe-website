import Link from "next/link";
import T from "@/components/T";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import EmptyState from "@/components/admin/EmptyState";
import ExportButton from "@/components/admin/ExportButton";
import StatCard from "@/components/admin/StatTile";
import type { Metadata } from "next";
import PurchaseInvoiceForm from "@/app/admin/purchasing/_components/PurchaseInvoiceForm";
import { purchaseMemory } from "@/lib/purchase-memory";
import { productSizes } from "@/lib/shoe-sizes";
import SupplierPaymentForm from "@/app/admin/purchasing/_components/SupplierPaymentForm";
import LoadFailure from "@/components/admin/LoadFailure";
import { money } from "@/lib/format-money";
import { getOperationsSnapshot } from "@/lib/operations";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { getProducts } from "@/lib/product-store";
import { getPurchasingSnapshot, type PurchaseInvoice, type SupplierAgingRisk } from "@/lib/purchasing";
import { billHasKind, purchaseKindTotals, purchaseLinesOf } from "@/lib/purchase-kinds";

type ListFilter = "all" | "ready" | "raw";

export const metadata: Metadata = {
  title: "Purchasing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";


function invoiceTone(invoice: PurchaseInvoice) {
  if (invoice.status === "Credit") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (invoice.status === "Partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function postingTone(signal: string) {
  return signal === "Posted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-800";
}

function agingTone(risk: SupplierAgingRisk) {
  if (risk === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (risk === "Watch") return "border-amber-200 bg-amber-50 text-amber-800";
  if (risk === "Current") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

function paymentPriorityTone(priority: string) {
  if (priority === "Immediate") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (priority === "Scheduled") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Normal") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

// Three loads, and any one failing used to take the whole page to the shop's
// retry screen. Next replaces a server error message with a bare digest in
// production, so the reason never reached the owner — which is why "it says
// quick retry again" could be reported three times and diagnosed none.
async function loadPurchasing() {
  try {
    return {
      data: await Promise.all([
        getPurchasingSnapshot(),
        getOperationsSnapshot(),
        getProducts({ includeDrafts: true }),
      ]),
      error: "",
    };
  } catch (error) {
    reportError("load the purchasing page", error);
    return { data: null, error: saveFailureMessage(error, "Could not load purchasing.") };
  }
}

export default async function AdminPurchasingPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>;
}) {
  const loaded = await loadPurchasing();
  const show: ListFilter = ((await searchParams)?.show as ListFilter) || "all";
  const listFilter: ListFilter = show === "ready" || show === "raw" ? show : "all";

  if (!loaded.data) {
    return (
      <LoadFailure
        what="the purchase bills and suppliers"
        message={loaded.error}
        retryHref="/admin/purchasing"
      />
    );
  }

  const [purchasing, operations, products] = loaded.data;
  const productNames = [...new Set(products.map((product) => product.name))].sort((a, b) =>
    a.localeCompare(b),
  );
  // Pairs on hand per design name, so the design picker can show "68 in stock"
  // beside a suggestion the way the POS picker does — the buyer sees what is
  // already on the shelf before ordering more. Summed across sizes/SKUs that
  // share a name. Built from the same products list; no new data.
  const productStockByName = new Map<string, number>();
  for (const product of products) {
    const pairs = Math.max(0, Math.round(Number(product.stock) || 0));
    productStockByName.set(product.name, (productStockByName.get(product.name) ?? 0) + pairs);
  }
  const productStock = [...productStockByName.entries()].map(([name, stock]) => ({ name, stock }));
  // The sizes each design is made in, so a ready-made purchase line offers
  // exactly those boxes. Lower-cased, the way the form matches a typed name.
  const designSizes: Record<string, string[]> = {};
  for (const product of products) {
    const sizes = productSizes(product.sizes);
    if (sizes.length) designSizes[product.name.trim().toLowerCase()] = sizes;
  }
  // Last rates, each supplier's last bill and their bill numbers — read back
  // from the bills already on the page's data, nothing new stored.
  const memory = purchaseMemory(purchasing.purchaseInvoices);
  const supplierAgingById = new Map(
    purchasing.reports.supplierAgingRows.map((row) => [row.supplierLedgerId, row]),
  );
  const dueAgingRows = purchasing.reports.supplierAgingRows.filter((row) => row.balanceDue > 0);
  const supplierPaymentRows = purchasing.reports.supplierPaymentFollowups.filter(
    (row) => row.priority !== "Clear",
  );
  // This month's buying, split into what it is: ready-made shoes (pairs, to
  // sellable stock) and raw material (metres, kilos, to the factory store).
  // Same month the tiles above count — the bill's own date, as filed.
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthKinds = purchaseKindTotals(
    purchasing.purchaseInvoices.filter((invoice) => invoice.createdAt.slice(0, 7) === monthKey),
  );
  // The bill list, every line shown, filtered by what the bill carried.
  const listedInvoices = purchasing.purchaseInvoices
    .filter((invoice) =>
      listFilter === "ready"
        ? billHasKind(invoice, "Trading Goods")
        : listFilter === "raw"
          ? billHasKind(invoice, "Raw Material")
          : true,
    )
    .slice(0, 20);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            <T en="Purchase" ne="किनमेल" />
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink"><T en="Purchasing and supplier ledger" ne="किनमेल र साहुको खाता" /></h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            Raw material purchase, supplier due, payment history, and purchase-basis profit signal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            href="/api/admin/purchasing/export?type=invoices"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            Export purchases
          </ExportButton>
          <ExportButton
            href="/api/admin/purchasing/export?type=suppliers"
            className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export suppliers
          </ExportButton>
          <ExportButton
            href="/api/admin/purchasing/export?type=supplier-aging"
            className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Aging report
          </ExportButton>
          <ExportButton
            href="/api/admin/purchasing/export?type=supplier-payables"
            className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Payment queue
          </ExportButton>
          <ExportButton
            href="/api/admin/purchasing/export?type=posting-review"
            className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Posting review
          </ExportButton>
        </div>
      </div>

      {/* The bill has the whole width now, and the whole job with it. The
          "New supplier" form that used to sit beside it is gone: a supplier is
          named in the bill, which is where the shopkeeper is standing when a
          new name turns up on a delivery. */}
      <div className="mt-6 print:hidden">
        <PurchaseInvoiceForm
          supplierLedgers={purchasing.supplierLedgers}
          rawMaterials={operations.rawMaterials}
          productNames={productNames}
          productStock={productStock}
          memory={memory}
          designSizes={designSizes}
        />
      </div>

      {/* The figures come after the bill: the page opens on the job, with the
          cursor in the supplier box, not on seven tiles to scroll past. Three
          are read every day; the other four wait under "More". */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={<T en="Today purchase" ne="आजको किनाइ" />} value={money(purchasing.summary.todayPurchase)} detail={<T en="ready-made and raw material" ne="तयार जुत्ता र कच्चा माल" />} />
        <StatCard label={<T en="Month purchase" ne="महिनाको किनाइ" />} value={money(purchasing.summary.monthPurchase)} detail={`${purchasing.summary.purchaseInvoiceCount} invoices`} />
        <StatCard label={<T en="Supplier due" ne="साहुलाई तिर्न बाँकी" />} value={money(purchasing.summary.supplierDue)} detail={`${purchasing.summary.supplierCount} suppliers`} />
      </div>
      <details className="mt-3 rounded-lg border border-brand-green-line bg-brand-paper px-4 py-2">
        <summary className="cursor-pointer text-sm font-bold text-brand-green-ink">
          <T en="▾ More figures" ne="▾ थप हिसाब" />
        </summary>
        <div className="mt-3 grid gap-4 pb-2 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label={<T en="Over 90 due" ne="९० दिनभन्दा पुरानो" />} value={money(purchasing.summary.supplierOver90Due)} detail={`${purchasing.summary.supplierAgingRiskCount} aging risk`} />
          <StatCard label={<T en="Pay today" ne="आज तिर्नुपर्ने" />} value={money(purchasing.reports.supplierPaymentSummary.immediateDue)} detail={`${purchasing.summary.supplierImmediatePaymentCount} immediate`} />
          <StatCard label={<T en="Posting review" ne="चढेको हेर्न बाँकी" />} value={purchasing.summary.postingNeedsReview} detail={`${purchasing.summary.postedInvoiceCount} posted invoices`} />
          {/* Sales less purchases, and nothing more: pairs bought this month
              are mostly still on the shelf, so this is not the month's profit
              or loss, and must not read like one. */}
          <StatCard label={<T en="Month sales − purchases" ne="महिनाको बिक्री − खरिद" />} value={money(purchasing.summary.monthProfitEstimate)} detail={<T en="not profit: stock bought is still on hand" ne="नाफा होइन: किनेको माल स्टकमै छ" />} />
        </div>
      </details>

      {/* Settling an OLD due, which is a different act on a different day from
          paying for a bill as it arrives. That one is part of the bill above. */}
      <div className="mt-6 max-w-xl print:hidden">
        <SupplierPaymentForm
          suppliers={purchasing.supplierLedgers.map((supplier) => ({
            id: supplier.id,
            name: supplier.supplierName,
            due: supplier.balanceDue,
          }))}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-4">
        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink"><T en="Sales − purchases" ne="बिक्री − खरिद" /></h2>
          <p className="mt-1 text-xs text-brand-muted">
            <T
              en="POS sales less what was bought. Not profit: goods bought are still in stock."
              ne="POS बिक्रीबाट खरिद घटाएको मात्र। नाफा होइन: किनेको माल अझै स्टकमा छ।"
            />
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-brand-paper-deep p-3">
              <p className="text-xs font-semibold text-brand-muted">Today</p>
              <p className="mt-1 text-xl font-black text-brand-green-ink">{money(purchasing.summary.todayProfitEstimate)}</p>
            </div>
            <div className="rounded-md bg-brand-paper-deep p-3">
              <p className="text-xs font-semibold text-brand-muted">Month</p>
              <p className="mt-1 text-xl font-black text-brand-green-ink">{money(purchasing.summary.monthProfitEstimate)}</p>
            </div>
            <div className="rounded-md bg-brand-paper-deep p-3">
              <p className="text-xs font-semibold text-brand-muted">Year</p>
              <p className="mt-1 text-xl font-black text-brand-green-ink">{money(purchasing.summary.yearProfitEstimate)}</p>
            </div>
          </div>
        </section>

        {/* What this month's buying was, by kind. It used to be one list,
            "Material purchase", read off each bill's first line — so a delivery
            of ready-made Doctor Chappal showed as raw material, and a bill's
            other lines did not show at all. */}
        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink"><T en="This month's buying" ne="यो महिनाको किनाइ" /></h2>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-sm font-black text-brand-green-ink">👟 <T en="Ready-made shoes" ne="तयार जुत्ता" /></p>
              <p className="mt-1 text-xl font-black tabular-nums text-brand-green-ink">{money(monthKinds.ready.total)}</p>
              <p className="text-xs text-brand-muted">
                <T
                  en={`${monthKinds.ready.pairs} pairs · ${monthKinds.ready.bills} bills`}
                  ne={`${monthKinds.ready.pairs} जोडी · ${monthKinds.ready.bills} बिल`}
                />
              </p>
              <ul className="mt-2 divide-y divide-brand-green-line text-sm">
                {monthKinds.ready.top.map((row) => (
                  <li key={row.name} className="flex justify-between gap-3 py-1.5">
                    <span className="font-semibold text-brand-green-ink">{row.name}</span>
                    <span className="tabular-nums text-brand-muted">
                      <T en={`${row.quantity} pairs`} ne={`${row.quantity} जोडी`} /> · {money(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-black text-brand-green-ink">🧵 <T en="Raw material" ne="कच्चा माल" /></p>
              <p className="mt-1 text-xl font-black tabular-nums text-brand-green-ink">{money(monthKinds.raw.total)}</p>
              <p className="text-xs text-brand-muted">
                <T en={`${monthKinds.raw.bills} bills`} ne={`${monthKinds.raw.bills} बिल`} />
              </p>
              <ul className="mt-2 divide-y divide-brand-green-line text-sm">
                {monthKinds.raw.top.map((row) => (
                  <li key={`${row.name}-${row.unit}`} className="flex justify-between gap-3 py-1.5">
                    <span className="font-semibold text-brand-green-ink">{row.name}</span>
                    <span className="tabular-nums text-brand-muted">
                      {row.quantity} {row.unit} · {money(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="supplier-ledgers" className="scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink"><T en="Supplier ledgers" ne="साहुका खाता" /></h2>
          <div className="mt-4 divide-y divide-brand-green-line">
            {purchasing.reports.supplierDueRows.slice(0, 6).map((supplier) => {
              const aging = supplierAgingById.get(supplier.id);

              return (
                <div key={supplier.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/purchasing/supplier/${supplier.id}`}
                      className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                    >
                      {supplier.supplierName}
                    </Link>
                    <p className="font-black text-brand-clay">{money(supplier.balanceDue)}</p>
                  </div>
                  <p className="mt-1 text-xs text-brand-muted">
                    Paid {money(supplier.paidAmount)} / Purchase {money(supplier.totalPurchase)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#8A5A15]">
                    Oldest {aging?.oldestOpenDays ?? 0} days / 90+ {money(aging?.over90 ?? 0)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink"><T en="Posting health" ne="चढेको ठीक छ कि" /></h2>
          <p className="mt-1 text-sm text-brand-muted">Supplier ledger, raw material link, and payment posting check.</p>
          <div className="mt-4 divide-y divide-brand-green-line">
            {purchasing.reports.postingReviewRows.slice(0, 6).map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold text-brand-green-ink">{row.purchaseNumber}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${postingTone(row.signal)}`}>
                    {row.signal}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-brand-muted-deep">{row.materialName}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  Txn {row.linkedTransactionCount}/{row.expectedTransactionCount}
                  {row.issues ? ` - ${row.issues}` : ""}
                </p>
              </div>
            ))}
            {purchasing.reports.postingReviewRows.length === 0 ? (
              <p className="py-3 text-sm text-brand-muted">No purchase posting to review yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink"><T en="Supplier payment queue" ne="साहुलाई तिर्ने पालो" /></h2>
            <p className="mt-1 text-sm text-brand-muted">
              Payable priority, due date, and next action for supplier relationship control.
            </p>
          </div>
          <ExportButton
            href="/api/admin/purchasing/export?type=supplier-payables"
            className="rounded-full border border-brand-green-line bg-brand-paper px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Export payment queue
          </ExportButton>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <p className="text-xs font-semibold text-brand-muted">Immediate</p>
            <p className="mt-1 text-xl font-black text-brand-clay">
              {purchasing.reports.supplierPaymentSummary.immediateCount}
            </p>
          </div>
          <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <p className="text-xs font-semibold text-brand-muted">High</p>
            <p className="mt-1 text-xl font-black text-brand-gold-ink">
              {purchasing.reports.supplierPaymentSummary.highCount}
            </p>
          </div>
          <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <p className="text-xs font-semibold text-brand-muted">Payment run</p>
            <p className="mt-1 text-xl font-black text-brand-green-ink">
              {money(purchasing.reports.supplierPaymentSummary.paymentRunDue)}
            </p>
          </div>
          <div className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <p className="text-xs font-semibold text-brand-muted">Supplier due</p>
            <p className="mt-1 text-xl font-black text-brand-green-ink">
              {money(purchasing.reports.supplierPaymentSummary.totalDue)}
            </p>
          </div>
        </div>

        {supplierPaymentRows.length === 0 ? (
          <EmptyState
            icon="🤝"
            title={<T en="Nothing to chase today" ne="आज कसैलाई तिर्न बाँकी छैन" />}
            detail={
              <T
                en="Suppliers appear here as their bills come due, most urgent first."
                ne="साहुका बिल तिर्ने समय आएपछि यहाँ देखिन्छन् — सबैभन्दा जरुरी पहिले।"
              />
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3">Aging</th>
                  <th className="py-2 pr-3">Payment date</th>
                  <th className="py-2 pr-3">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplierPaymentRows.slice(0, 12).map((row) => (
                  <tr key={row.supplierLedgerId}>
                    <td className="reflow-primary py-3 pr-3">
                      <Link
                        href={`/admin/purchasing/supplier/${row.supplierLedgerId}`}
                        className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                      >
                        {row.supplierName}
                      </Link>
                      <p className="mt-1 text-xs text-brand-muted">
                        {row.materialFocus || "General supply"} | {row.phone || "No phone"}
                      </p>
                    </td>
                    <td data-label="Priority" className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentPriorityTone(row.priority)}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td data-label="Due" className="py-3 pr-3 font-bold text-brand-clay">{money(row.balanceDue)}</td>
                    <td data-label="Aging" className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days oldest</p>
                      <p className="text-xs text-brand-muted">90+ {money(row.over90)}</p>
                    </td>
                    <td data-label="Payment date" className="py-3 pr-3 font-semibold text-brand-green-ink">{row.paymentDueDate || "-"}</td>
                    <td data-label="Next action" className="max-w-80 py-3 pr-3 text-xs font-semibold leading-5 text-brand-muted">
                      {row.nextAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink"><T en="Supplier aging report" ne="साहुको पुरानो बाँकी" /></h2>
            <p className="mt-1 text-sm text-brand-muted">
              Due amount grouped by age so old supplier payable is visible before it becomes risky.
            </p>
          </div>
          <p className="text-sm font-bold text-brand-clay">
            90+ due {money(purchasing.reports.supplierAgingTotals.over90)}
          </p>
        </div>

        {dueAgingRows.length === 0 ? (
          <EmptyState
            icon="✅"
            title={<T en="Every supplier is settled" ne="सबै साहुको हिसाब मिलेको छ" />}
            detail={
              <T
                en="An unpaid bill shows here as it ages, so nothing old goes unnoticed."
                ne="नतिरेको बिल पुरानो हुँदै जाँदा यहाँ देखिन्छ, त्यसैले कुनै पनि छुट्दैन।"
              />
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">0-30</th>
                  <th className="py-2 pr-3">31-60</th>
                  <th className="py-2 pr-3">61-90</th>
                  <th className="py-2 pr-3">90+</th>
                  <th className="py-2 pr-3">Oldest</th>
                  <th className="py-2 pr-3">Risk</th>
                  <th className="py-2 pr-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dueAgingRows.slice(0, 12).map((row) => (
                  <tr key={row.supplierLedgerId}>
                    <td className="reflow-primary py-3 pr-3">
                      <Link
                        href={`/admin/purchasing/supplier/${row.supplierLedgerId}`}
                        className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                      >
                        {row.supplierName}
                      </Link>
                      <p className="mt-1 text-xs text-brand-muted">{row.materialFocus || "General supply"}</p>
                    </td>
                    <td data-label="0-30" className="py-3 pr-3">{money(row.current)}</td>
                    <td data-label="31-60" className="py-3 pr-3">{money(row.days31To60)}</td>
                    <td data-label="61-90" className="py-3 pr-3">{money(row.days61To90)}</td>
                    <td data-label="90+" className="py-3 pr-3 font-bold text-brand-clay">{money(row.over90)}</td>
                    <td data-label="Oldest" className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days</p>
                      <p className="text-xs text-brand-muted">{row.oldestOpenDate || "-"}</p>
                    </td>
                    <td data-label="Risk" className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${agingTone(row.risk)}`}>
                        {row.risk}
                      </span>
                    </td>
                    <td data-label="Due" className="py-3 pr-3 font-black text-brand-green-ink">{money(row.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="purchase-bills" className="mt-8 scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink"><T en="Recent purchase invoices" ne="भर्खरका किनाइ बिल" /></h2>
            <p className="mt-1 text-sm text-brand-muted">
              Raw material stock receipt, supplier due, and payment trail.
            </p>
          </div>
          <p className="text-sm font-bold text-brand-green">Year purchase {money(purchasing.summary.yearPurchase)}</p>
        </div>

        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Show">
          {(
            [
              ["all", <T key="all" en="All" ne="सबै" />],
              ["ready", <T key="ready" en="👟 Ready-made" ne="👟 तयार जुत्ता" />],
              ["raw", <T key="raw" en="🧵 Raw material" ne="🧵 कच्चा माल" />],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/purchasing#purchase-bills" : `/admin/purchasing?show=${value}#purchase-bills`}
              aria-current={listFilter === value ? "page" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
                listFilter === value
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-brand-green-line bg-brand-paper text-brand-green-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {listedInvoices.length === 0 ? (
          <EmptyState
            icon="📦"
            title={<T en="No purchases yet" ne="अहिलेसम्म कुनै किनाइ छैन" />}
            detail={
              <T
                en="Record a purchase with the form above and it lands here, with what is paid and what is owed."
                ne="माथिको फारमबाट किनाइ टिप्नुहोस् — कति तिरियो र कति बाँकी छ सहित यहाँ आउँछ।"
              />
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Purchase</th>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3"><T en="Items (every line)" ne="सामान (सबै लाइन)" /></th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Paid / Due</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Posting</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listedInvoices.map((invoice) => {
                  const posting = purchasing.reports.postingReviewRows.find((row) => row.id === invoice.id);

                  return (
                    <tr key={invoice.id}>
                      <td className="reflow-primary py-3 pr-3">
                        {/* Opens the single-bill page, which prints clean on one
                            sheet — no more printing the whole screen. */}
                        <Link
                          href={`/admin/purchasing/${invoice.id}`}
                          className="font-mono text-xs font-bold text-brand-green underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green-ink"
                        >
                          {invoice.purchaseNumber}
                        </Link>
                        {/* The supplier's own number, beneath ours. It is the
                            one they quote on the phone, so reconciling an
                            account means reading it off this row rather than
                            opening every bill. Said plainly when it is absent,
                            because a missing one is worth noticing. */}
                        {invoice.supplierBillNo ? (
                          <p className="mt-0.5 text-xs text-brand-muted">
                            <T en="Their bill" ne="साहुको बिल" />:{" "}
                            <span className="font-mono font-bold text-brand-green-ink">
                              {invoice.supplierBillNo}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-brand-muted-soft">
                            <T en="No bill no." ne="बिल नं. छैन" />
                          </p>
                        )}
                        <p className="mt-1 text-xs text-brand-muted"><DateDisplayAdmin date={invoice.createdAt} time={true} /></p>
                      </td>
                      <td data-label="Supplier" className="py-3 pr-3">
                        <Link
                          href={`/admin/purchasing/supplier/${invoice.supplierLedgerId}`}
                          className="font-semibold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                        >
                          {invoice.supplierName}
                        </Link>
                      </td>
                      <td data-label="Items" className="py-3 pr-3">
                        {/* Every line of the bill, each marked by kind — not the
                            first line standing in for all of them. */}
                        <ul className="grid gap-0.5">
                          {purchaseLinesOf(invoice).map((line, index) => (
                            <li key={index} className="text-sm">
                              <span aria-hidden="true">{line.kind === "Trading Goods" ? "👟 " : "🧵 "}</span>
                              <span className="font-semibold">{line.name}</span>
                              <span className="text-xs text-brand-muted">
                                {" · "}
                                {line.kind === "Trading Goods" ? (
                                  <T en={`${line.quantity} pairs`} ne={`${line.quantity} जोडी`} />
                                ) : (
                                  `${line.quantity} ${line.unit}`
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td data-label="Total" className="py-3 pr-3 font-bold">{money(invoice.total)}</td>
                      <td data-label="Paid / Due" className="py-3 pr-3">
                        <p>Paid {money(invoice.paidAmount)}</p>
                        <p className="text-xs text-brand-muted">Due {money(invoice.creditAmount)}</p>
                      </td>
                      <td data-label="Status" className="py-3 pr-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${invoiceTone(invoice)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td data-label="Posting" className="py-3 pr-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${postingTone(posting?.signal ?? "Needs Review")}`}>
                          {posting?.signal ?? "Needs Review"}
                        </span>
                        <p className="mt-1 text-xs text-brand-muted">
                          {posting?.issues || `Txn ${posting?.linkedTransactionCount ?? 0}/${posting?.expectedTransactionCount ?? 0}`}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
