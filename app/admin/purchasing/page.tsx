import Link from "next/link";
import T from "@/components/T";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import ExportButton from "@/components/admin/ExportButton";
import StatCard from "@/components/admin/StatTile";
import type { Metadata } from "next";
import PurchaseInvoiceForm from "@/app/admin/purchasing/_components/PurchaseInvoiceForm";
import SupplierPaymentForm from "@/app/admin/purchasing/_components/SupplierPaymentForm";
import LoadFailure from "@/components/admin/LoadFailure";
import { getOperationsSnapshot } from "@/lib/operations";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { getProducts } from "@/lib/product-store";
import { getPurchasingSnapshot, type PurchaseInvoice, type SupplierAgingRisk } from "@/lib/purchasing";

export const metadata: Metadata = {
  title: "Purchasing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

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

export default async function AdminPurchasingPage() {
  const loaded = await loadPurchasing();

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
  const supplierAgingById = new Map(
    purchasing.reports.supplierAgingRows.map((row) => [row.supplierLedgerId, row]),
  );
  const dueAgingRows = purchasing.reports.supplierAgingRows.filter((row) => row.balanceDue > 0);
  const supplierPaymentRows = purchasing.reports.supplierPaymentFollowups.filter(
    (row) => row.priority !== "Clear",
  );

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

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Today purchase" value={money(purchasing.summary.todayPurchase)} detail="raw material cost" />
        <StatCard label="Month purchase" value={money(purchasing.summary.monthPurchase)} detail={`${purchasing.summary.purchaseInvoiceCount} invoices`} />
        <StatCard label="Supplier due" value={money(purchasing.summary.supplierDue)} detail={`${purchasing.summary.supplierCount} suppliers`} />
        <StatCard label="Over 90 due" value={money(purchasing.summary.supplierOver90Due)} detail={`${purchasing.summary.supplierAgingRiskCount} aging risk`} />
        <StatCard label="Pay today" value={money(purchasing.reports.supplierPaymentSummary.immediateDue)} detail={`${purchasing.summary.supplierImmediatePaymentCount} immediate`} />
        <StatCard label="Posting review" value={purchasing.summary.postingNeedsReview} detail={`${purchasing.summary.postedInvoiceCount} posted invoices`} />
        <StatCard label="Month profit signal" value={money(purchasing.summary.monthProfitEstimate)} detail="POS net sales minus purchases" />
      </div>

      {/* The bill has the whole width now, and the whole job with it. The
          "New supplier" form that used to sit beside it is gone: a supplier is
          named in the bill, which is where the shopkeeper is standing when a
          new name turns up on a delivery. */}
      <div className="mt-8 print:hidden">
        <PurchaseInvoiceForm
          supplierLedgers={purchasing.supplierLedgers}
          rawMaterials={operations.rawMaterials}
          productNames={productNames}
          productStock={productStock}
        />
      </div>

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
          <h2 className="text-lg font-black text-brand-green-ink"><T en="Profit signal" ne="नाफाको सङ्केत" /></h2>
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

        <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Material purchase</h2>
          <div className="mt-4 divide-y divide-brand-green-line">
            {purchasing.reports.materialTotals.slice(0, 6).map((row) => (
              <div key={row.materialName} className="grid grid-cols-3 gap-3 py-3 text-sm">
                <p className="font-bold text-brand-green-ink">{row.materialName}</p>
                <p className="text-brand-muted">{row.quantity}</p>
                <p className="text-right font-bold">{money(row.total)}</p>
              </div>
            ))}
            {purchasing.reports.materialTotals.length === 0 ? (
              <p className="py-3 text-sm text-brand-muted">No material purchase recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section id="supplier-ledgers" className="scroll-mt-24 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Supplier ledgers</h2>
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
          <h2 className="text-lg font-black text-brand-green-ink">Posting health</h2>
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
            <h2 className="text-lg font-black text-brand-green-ink">Supplier payment queue</h2>
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
          <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
            No supplier payment follow-up is due right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
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
                    <td className="py-3 pr-3">
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
                    <td className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentPriorityTone(row.priority)}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-bold text-brand-clay">{money(row.balanceDue)}</td>
                    <td className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days oldest</p>
                      <p className="text-xs text-brand-muted">90+ {money(row.over90)}</p>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-brand-green-ink">{row.paymentDueDate || "-"}</td>
                    <td className="max-w-80 py-3 pr-3 text-xs font-semibold leading-5 text-brand-muted">
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
            <h2 className="text-lg font-black text-brand-green-ink">Supplier aging report</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Due amount grouped by age so old supplier payable is visible before it becomes risky.
            </p>
          </div>
          <p className="text-sm font-bold text-brand-clay">
            90+ due {money(purchasing.reports.supplierAgingTotals.over90)}
          </p>
        </div>

        {dueAgingRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
            No supplier due is open right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
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
                    <td className="py-3 pr-3">
                      <Link
                        href={`/admin/purchasing/supplier/${row.supplierLedgerId}`}
                        className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green"
                      >
                        {row.supplierName}
                      </Link>
                      <p className="mt-1 text-xs text-brand-muted">{row.materialFocus || "General supply"}</p>
                    </td>
                    <td className="py-3 pr-3">{money(row.current)}</td>
                    <td className="py-3 pr-3">{money(row.days31To60)}</td>
                    <td className="py-3 pr-3">{money(row.days61To90)}</td>
                    <td className="py-3 pr-3 font-bold text-brand-clay">{money(row.over90)}</td>
                    <td className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days</p>
                      <p className="text-xs text-brand-muted">{row.oldestOpenDate || "-"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${agingTone(row.risk)}`}>
                        {row.risk}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.balanceDue)}</td>
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
            <h2 className="text-lg font-black text-brand-green-ink">Recent purchase invoices</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Raw material stock receipt, supplier due, and payment trail.
            </p>
          </div>
          <p className="text-sm font-bold text-brand-green">Year purchase {money(purchasing.summary.yearPurchase)}</p>
        </div>

        {purchasing.reports.recentInvoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-brand-green-line p-6 text-sm text-brand-muted">
            Purchase history is empty. Record the first raw material purchase above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Purchase</th>
                  <th className="py-2 pr-3">Supplier</th>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Paid / Due</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Posting</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchasing.reports.recentInvoices.map((invoice) => {
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
                      <td data-label="Material" className="py-3 pr-3">
                        <p className="font-semibold">{invoice.materialName}</p>
                        <p className="text-xs text-brand-muted">{invoice.unit}</p>
                      </td>
                      <td data-label="Qty" className="py-3 pr-3">{invoice.quantity}</td>
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
