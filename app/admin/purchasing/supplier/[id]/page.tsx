import type { Metadata } from "next";
import { formatAdminDate } from "@/lib/format-date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupplierTransactionAction } from "@/app/admin/purchasing/actions";
import PrintSupplierLedgerButton from "@/app/admin/purchasing/supplier/[id]/PrintSupplierLedgerButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  getSupplierLedgerDetail,
  type PurchaseInvoice,
  type SupplierAgingRisk,
  type SupplierLedgerStatementRow,
  type SupplierTransactionType,
} from "@/lib/purchasing";

type SupplierLedgerPageProps = {
  params: Promise<{ id: string }>;
};

const inputClass =
  "h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function transactionTone(type: SupplierTransactionType) {
  if (type === "Purchase Bill" || type === "Manual Adjustment") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
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

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function StatementRow({ row }: { row: SupplierLedgerStatementRow }) {
  return (
    <tr>
      <td className="py-3 pr-3 text-xs text-gray-500">{formatDate(row.createdAt)}</td>
      <td className="py-3 pr-3">
        <Badge className={transactionTone(row.type)}>{row.type}</Badge>
      </td>
      <td className="py-3 pr-3">{row.effect}</td>
      <td className="py-3 pr-3 font-bold">{money(row.amount)}</td>
      <td className="py-3 pr-3 font-black text-brand-green-ink">{money(row.balanceAfter)}</td>
      <td className="max-w-96 py-3 pr-3 text-gray-600">{row.note || "-"}</td>
    </tr>
  );
}

export async function generateMetadata({ params }: SupplierLedgerPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getSupplierLedgerDetail(id);

  return {
    title: detail ? `${detail.ledger.supplierName} Supplier Ledger | KRISHOE Admin` : "Supplier Ledger Not Found",
  };
}

export const dynamic = "force-dynamic";

export default async function SupplierLedgerDetailPage({ params }: SupplierLedgerPageProps) {
  const { id } = await params;
  const detail = await getSupplierLedgerDetail(id);

  if (!detail) {
    notFound();
  }

  const { ledger, invoices, statementRows, summary, aging } = detail;
  const returnTo = `/admin/purchasing/supplier/${ledger.id}`;

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/purchasing"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          Back to purchasing
        </Link>
        <PrintSupplierLedgerButton />
      </div>

      <div className="receipt-print rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              Supplier ledger statement
            </p>
            <h1 className="mt-2 text-3xl font-black text-brand-green-ink">{ledger.supplierName}</h1>
            <p className="mt-2 text-sm text-gray-500">
              {ledger.phone || "No phone"} - {ledger.materialFocus || "General supply"} - Last transaction {ledger.lastTransaction}
            </p>
          </div>
          <div className="rounded-lg bg-brand-mist px-5 py-4 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Supplier due</p>
            <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(summary.balanceDue)}</p>
          </div>
        </div>

        {/* The summary cards and the priority banner are on-screen dashboards.
            On a printed statement they push the trail onto a second sheet and
            add nothing the header due and the running balance don't already
            show, so they are hidden on paper. */}
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6 print:hidden">
          <StatCard label="Total purchase" value={money(summary.purchaseTotal)} detail={`${summary.purchaseCount} bills`} />
          <StatCard label="Invoice paid" value={money(summary.paidFromInvoices)} detail="paid on bills" />
          <StatCard label="Payment posted" value={money(summary.paymentTotal)} detail="cash/cheque/bank" />
          <StatCard label="Return adjustment" value={money(summary.returnAdjustmentTotal)} detail="due reduced" />
          <StatCard label="Average bill" value={money(summary.averagePurchaseValue)} detail={`${summary.transactionCount} transactions`} />
          <StatCard label="Payment due" value={summary.paymentDueDate || "-"} detail={summary.paymentPriority} />
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Aging risk</p>
            <div className="mt-3">
              <Badge className={agingTone(aging?.risk ?? "Clear")}>{aging?.risk ?? "Clear"}</Badge>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
              {aging ? `${aging.oldestOpenDays} days oldest` : "no due"}
            </p>
          </div>
        </div>

        <div className={`mt-5 rounded-lg border p-4 print:hidden ${paymentPriorityTone(summary.paymentPriority)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-[0.16em]">
              Supplier payment priority: {summary.paymentPriority}
            </p>
            <p className="text-sm font-bold">Due {summary.paymentDueDate || "cleared"}</p>
          </div>
          <p className="mt-2 text-sm font-semibold">{summary.nextPaymentAction}</p>
        </div>

        <form action={createSupplierTransactionAction} className="mt-6 grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 print:hidden">
          <div>
            <h2 className="font-black text-brand-green-ink">Record supplier payment / adjustment</h2>
            <p className="mt-1 text-sm text-gray-500">
              Payment decreases supplier due. Manual adjustment increases due.
            </p>
          </div>
          <input type="hidden" name="supplierLedgerId" value={ledger.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 md:grid-cols-3">
            <select name="type" className={inputClass} defaultValue="Cash Payment">
              <option>Cash Payment</option>
              <option>Cheque Payment</option>
              <option>Bank Payment</option>
              <option>Return Adjustment</option>
              <option>Manual Adjustment</option>
            </select>
            <input name="amount" type="number" min="1" required className={inputClass} placeholder="Amount" />
            <textarea name="note" className={textareaClass} placeholder="Voucher, cheque, bank reference, return note, or remark" />
          </div>
          <FormSubmitButton className="h-10 w-fit rounded-full bg-brand-green-ink px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
            Record transaction
          </FormSubmitButton>
        </form>

        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Statement trail</h2>
              <p className="mt-1 text-sm text-gray-500">
                Purchase bill, supplier payment, return adjustment, and running due balance.
              </p>
            </div>
            <p className="text-sm font-bold text-brand-clay">Current due: {money(summary.balanceDue)}</p>
          </div>

          {statementRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No supplier transaction has been recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Effect</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Balance after</th>
                    <th className="py-2 pr-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {statementRows.map((row) => (
                    <StatementRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-black text-brand-green-ink">Purchase invoices</h2>
            <p className="mt-1 text-sm text-gray-500">
              Raw material purchase bills linked to this supplier.
            </p>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No purchase invoice has been linked to this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Purchase</th>
                    <th className="py-2 pr-3">Material</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Rate</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Paid / Due</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="py-3 pr-3">
                        <p className="font-mono text-xs font-bold text-brand-green-ink">{invoice.purchaseNumber}</p>
                        <p className="mt-1 text-xs text-gray-500">{formatDate(invoice.createdAt)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-brand-green-ink">{invoice.materialName}</p>
                        <p className="text-xs text-gray-500">{invoice.unit}</p>
                      </td>
                      <td className="py-3 pr-3">{invoice.quantity}</td>
                      <td className="py-3 pr-3">{money(invoice.rate)}</td>
                      <td className="py-3 pr-3 font-bold">{money(invoice.total)}</td>
                      <td className="py-3 pr-3">
                        <p>Paid {money(invoice.paidAmount)}</p>
                        <p className="text-xs text-gray-500">Due {money(invoice.creditAmount)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge className={invoiceTone(invoice)}>{invoice.status}</Badge>
                      </td>
                      <td className="max-w-64 py-3 pr-3 text-gray-600">
                        {invoice.paymentReference || invoice.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
