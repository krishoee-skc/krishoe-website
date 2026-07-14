import Link from "next/link";
import type { Metadata } from "next";
import {
  createPurchaseInvoiceAction,
  createSupplierLedgerAction,
  createSupplierTransactionAction,
} from "@/app/admin/purchasing/actions";
import { getOperationsSnapshot } from "@/lib/operations";
import { getPurchasingSnapshot, type PurchaseInvoice, type SupplierAgingRisk } from "@/lib/purchasing";

export const metadata: Metadata = {
  title: "Purchasing | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#0B4D3B]";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B4D3B]";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function paymentPriorityTone(priority: string) {
  if (priority === "Immediate") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "High") return "border-orange-200 bg-orange-50 text-orange-800";
  if (priority === "Scheduled") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Normal") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#10231D]">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A958F]">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminPurchasingPage() {
  const [purchasing, operations] = await Promise.all([
    getPurchasingSnapshot(),
    getOperationsSnapshot(),
  ]);
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
          <h1 className="text-2xl font-black text-[#10231D]">Purchasing and supplier ledger</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Raw material purchase, supplier due, payment history, and purchase-basis profit signal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/api/admin/purchasing/export?type=invoices"
            className="rounded-full bg-[#0B4D3B] px-4 py-2 text-sm font-bold text-white"
          >
            Export purchases
          </Link>
          <Link
            href="/api/admin/purchasing/export?type=suppliers"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Export suppliers
          </Link>
          <Link
            href="/api/admin/purchasing/export?type=supplier-aging"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Aging report
          </Link>
          <Link
            href="/api/admin/purchasing/export?type=supplier-payables"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Payment queue
          </Link>
          <Link
            href="/api/admin/purchasing/export?type=posting-review"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Posting review
          </Link>
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

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form action={createPurchaseInvoiceAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-[#10231D]">Raw material purchase</h2>
            <p className="mt-1 text-sm text-gray-500">
              Purchase save posts supplier ledger and increases raw material received stock.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <select name="supplierLedgerId" className={inputClass} defaultValue="" aria-label="Supplier ledger">
              <option value="">New supplier from name</option>
              {purchasing.supplierLedgers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
            <input name="supplierName" className={inputClass} placeholder="New supplier name" />
            <input name="phone" className={inputClass} placeholder="Supplier phone" />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <select name="materialId" className={inputClass} required defaultValue="" aria-label="Raw material">
              <option value="">Select raw material</option>
              {operations.rawMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                </option>
              ))}
            </select>
            <input name="quantity" type="number" min="1" required className={inputClass} placeholder="Quantity" />
            <input name="rate" type="number" min="1" required className={inputClass} placeholder="Rate" />
            <select name="paymentMethod" className={inputClass} defaultValue="Cash" aria-label="Payment method">
              <option>Cash</option>
              <option>Cheque</option>
              <option>Bank</option>
              <option>Credit</option>
            </select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <input name="discount" type="number" min="0" className={inputClass} placeholder="Discount" />
            <input name="tax" type="number" min="0" className={inputClass} placeholder="Tax / VAT" />
            <input name="paidAmount" type="number" min="0" className={inputClass} placeholder="Paid amount" />
            <input name="paymentReference" className={inputClass} placeholder="Cheque/bank/ref no." />
          </div>

          <textarea name="note" className={`${textareaClass} mt-3 w-full`} placeholder="Purchase note, vehicle, gate pass, invoice no." />

          <button
            type="submit"
            className="mt-4 h-11 rounded-full bg-[#10231D] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
          >
            Save purchase
          </button>
        </form>

        <div className="grid gap-6">
          <form action={createSupplierLedgerAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#10231D]">New supplier</h2>
            <div className="mt-4 grid gap-3">
              <input name="supplierName" required className={inputClass} placeholder="Supplier name" />
              <input name="phone" className={inputClass} placeholder="Phone" />
              <input name="materialFocus" className={inputClass} placeholder="Material focus" />
              <button type="submit" className="h-10 rounded-full bg-[#0B4D3B] px-4 text-sm font-bold text-white">
                Add supplier
              </button>
            </div>
          </form>

          <form action={createSupplierTransactionAction} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#10231D]">Supplier payment</h2>
            <div className="mt-4 grid gap-3">
              <select name="supplierLedgerId" required className={inputClass} defaultValue="">
                <option value="">Select supplier</option>
                {purchasing.supplierLedgers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName} - due {money(supplier.balanceDue)}
                  </option>
                ))}
              </select>
              <select name="type" className={inputClass} defaultValue="Cash Payment">
                <option>Cash Payment</option>
                <option>Cheque Payment</option>
                <option>Bank Payment</option>
                <option>Return Adjustment</option>
                <option>Manual Adjustment</option>
              </select>
              <input name="amount" type="number" min="1" required className={inputClass} placeholder="Amount" />
              <textarea name="note" className={textareaClass} placeholder="Payment note or adjustment reason" />
              <button type="submit" className="h-10 rounded-full bg-[#10231D] px-4 text-sm font-bold text-white">
                Record payment
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#10231D]">Profit signal</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Today</p>
              <p className="mt-1 text-xl font-black text-[#10231D]">{money(purchasing.summary.todayProfitEstimate)}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Month</p>
              <p className="mt-1 text-xl font-black text-[#10231D]">{money(purchasing.summary.monthProfitEstimate)}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Year</p>
              <p className="mt-1 text-xl font-black text-[#10231D]">{money(purchasing.summary.yearProfitEstimate)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#10231D]">Material purchase</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {purchasing.reports.materialTotals.slice(0, 6).map((row) => (
              <div key={row.materialName} className="grid grid-cols-3 gap-3 py-3 text-sm">
                <p className="font-bold text-[#10231D]">{row.materialName}</p>
                <p className="text-gray-500">{row.quantity}</p>
                <p className="text-right font-bold">{money(row.total)}</p>
              </div>
            ))}
            {purchasing.reports.materialTotals.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No material purchase recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#10231D]">Supplier due</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {purchasing.reports.supplierDueRows.slice(0, 6).map((supplier) => {
              const aging = supplierAgingById.get(supplier.id);

              return (
                <div key={supplier.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/purchasing/supplier/${supplier.id}`}
                      className="font-bold text-[#10231D] underline decoration-[#D4AF37] underline-offset-4 transition hover:text-[#0B4D3B]"
                    >
                      {supplier.supplierName}
                    </Link>
                    <p className="font-black text-[#7B3128]">{money(supplier.balanceDue)}</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
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

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#10231D]">Posting health</h2>
          <p className="mt-1 text-sm text-gray-500">Supplier ledger, raw material link, and payment posting check.</p>
          <div className="mt-4 divide-y divide-gray-100">
            {purchasing.reports.postingReviewRows.slice(0, 6).map((row) => (
              <div key={row.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold text-[#10231D]">{row.purchaseNumber}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${postingTone(row.signal)}`}>
                    {row.signal}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-gray-700">{row.materialName}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Txn {row.linkedTransactionCount}/{row.expectedTransactionCount}
                  {row.issues ? ` - ${row.issues}` : ""}
                </p>
              </div>
            ))}
            {purchasing.reports.postingReviewRows.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No purchase posting to review yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Supplier payment queue</h2>
            <p className="mt-1 text-sm text-gray-500">
              Payable priority, due date, and next action for supplier relationship control.
            </p>
          </div>
          <Link
            href="/api/admin/purchasing/export?type=supplier-payables"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Export payment queue
          </Link>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">Immediate</p>
            <p className="mt-1 text-xl font-black text-[#7B3128]">
              {purchasing.reports.supplierPaymentSummary.immediateCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">High</p>
            <p className="mt-1 text-xl font-black text-[#7A5A00]">
              {purchasing.reports.supplierPaymentSummary.highCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">Payment run</p>
            <p className="mt-1 text-xl font-black text-[#10231D]">
              {money(purchasing.reports.supplierPaymentSummary.paymentRunDue)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-500">Supplier due</p>
            <p className="mt-1 text-xl font-black text-[#10231D]">
              {money(purchasing.reports.supplierPaymentSummary.totalDue)}
            </p>
          </div>
        </div>

        {supplierPaymentRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
            No supplier payment follow-up is due right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
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
                        className="font-bold text-[#10231D] underline decoration-[#D4AF37] underline-offset-4 transition hover:text-[#0B4D3B]"
                      >
                        {row.supplierName}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        {row.materialFocus || "General supply"} | {row.phone || "No phone"}
                      </p>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentPriorityTone(row.priority)}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-bold text-[#7B3128]">{money(row.balanceDue)}</td>
                    <td className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days oldest</p>
                      <p className="text-xs text-gray-500">90+ {money(row.over90)}</p>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-[#10231D]">{row.paymentDueDate || "-"}</td>
                    <td className="max-w-80 py-3 pr-3 text-xs font-semibold leading-5 text-gray-600">
                      {row.nextAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Supplier aging report</h2>
            <p className="mt-1 text-sm text-gray-500">
              Due amount grouped by age so old supplier payable is visible before it becomes risky.
            </p>
          </div>
          <p className="text-sm font-bold text-[#7B3128]">
            90+ due {money(purchasing.reports.supplierAgingTotals.over90)}
          </p>
        </div>

        {dueAgingRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
            No supplier due is open right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
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
                        className="font-bold text-[#10231D] underline decoration-[#D4AF37] underline-offset-4 transition hover:text-[#0B4D3B]"
                      >
                        {row.supplierName}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">{row.materialFocus || "General supply"}</p>
                    </td>
                    <td className="py-3 pr-3">{money(row.current)}</td>
                    <td className="py-3 pr-3">{money(row.days31To60)}</td>
                    <td className="py-3 pr-3">{money(row.days61To90)}</td>
                    <td className="py-3 pr-3 font-bold text-[#7B3128]">{money(row.over90)}</td>
                    <td className="py-3 pr-3">
                      <p>{row.oldestOpenDays} days</p>
                      <p className="text-xs text-gray-500">{row.oldestOpenDate || "-"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${agingTone(row.risk)}`}>
                        {row.risk}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-black text-[#10231D]">{money(row.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Recent purchase invoices</h2>
            <p className="mt-1 text-sm text-gray-500">
              Raw material stock receipt, supplier due, and payment trail.
            </p>
          </div>
          <p className="text-sm font-bold text-[#0B4D3B]">Year purchase {money(purchasing.summary.yearPurchase)}</p>
        </div>

        {purchasing.reports.recentInvoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
            Purchase history is empty. Record the first raw material purchase above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
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
                      <td className="py-3 pr-3">
                        <p className="font-mono text-xs font-bold text-[#10231D]">{invoice.purchaseNumber}</p>
                        <p className="mt-1 text-xs text-gray-500">{formatDate(invoice.createdAt)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/purchasing/supplier/${invoice.supplierLedgerId}`}
                          className="font-semibold text-[#10231D] underline decoration-[#D4AF37] underline-offset-4 transition hover:text-[#0B4D3B]"
                        >
                          {invoice.supplierName}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{invoice.materialName}</p>
                        <p className="text-xs text-gray-500">{invoice.unit}</p>
                      </td>
                      <td className="py-3 pr-3">{invoice.quantity}</td>
                      <td className="py-3 pr-3 font-bold">{money(invoice.total)}</td>
                      <td className="py-3 pr-3">
                        <p>Paid {money(invoice.paidAmount)}</p>
                        <p className="text-xs text-gray-500">Due {money(invoice.creditAmount)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${invoiceTone(invoice)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${postingTone(posting?.signal ?? "Needs Review")}`}>
                          {posting?.signal ?? "Needs Review"}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">
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
