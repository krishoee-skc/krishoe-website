import type { Metadata } from "next";
import { formatAdminDate } from "@/lib/format-date";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLedgerTransactionAction,
  deleteOperationRecordAction,
  updateCustomerLedgerAction,
} from "@/app/admin/operations/actions";
import ConfirmDeleteButton from "@/app/admin/operations/ConfirmDeleteButton";
import PrintLedgerButton from "@/app/admin/operations/ledger/PrintLedgerButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { getCustomerLedgerDetail, type LedgerTransaction } from "@/lib/operations";

type LedgerDetailPageProps = {
  params: Promise<{ id: string }>;
};

const inputClass =
  "h-10 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-brand-green";
const textareaClass =
  "min-h-24 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-green";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function transactionEffect(type: LedgerTransaction["type"]) {
  if (type === "Cash Payment" || type === "Cheque Payment" || type === "Return Adjustment") {
    return "Due reduced";
  }

  return "Due added";
}

function collectionPriorityClass(priority: string) {
  if (priority === "Clear") return "border-brand-green-line bg-brand-green-wash text-brand-green";
  if (priority === "Monitor" || priority === "Medium") return "border-[#F4DEAE] bg-[#FFF9EA] text-brand-gold-ink";
  return "border-[#F1C4BE] bg-[#FFF4F2] text-brand-clay";
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

export async function generateMetadata({ params }: LedgerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCustomerLedgerDetail(id);

  return {
    title: detail ? `${detail.ledger.customerName} Ledger | KRISHOE Admin` : "Ledger Not Found",
  };
}

export const dynamic = "force-dynamic";

export default async function CustomerLedgerDetailPage({ params }: LedgerDetailPageProps) {
  const { id } = await params;
  const detail = await getCustomerLedgerDetail(id);

  if (!detail) {
    notFound();
  }

  const { ledger, transactions, summary, paymentTransactions } = detail;
  const returnTo = `/admin/operations/ledger/${ledger.id}`;

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/operations"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          Back to operations
        </Link>
        <PrintLedgerButton />
      </div>

      <div className="receipt-print rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
              Customer ledger
            </p>
            <h1 className="mt-2 text-3xl font-black text-brand-green-ink">{ledger.customerName}</h1>
            <p className="mt-2 text-sm text-gray-500">
              {ledger.channel} - {ledger.phone || "No phone"} - Last transaction {ledger.lastTransaction}
            </p>
          </div>
          <div className="rounded-lg bg-brand-mist px-5 py-4 text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Balance due</p>
            <p className="mt-2 text-3xl font-black text-brand-green-ink">{money(summary.balanceDue)}</p>
          </div>
        </div>

        {/* Summary cards and the priority banner are on-screen dashboards; on a
            printed statement they push the trail onto a second sheet and repeat
            what the header due and the trail already show, so they hide on
            paper. */}
        <div className="mt-5 grid gap-4 md:grid-cols-5 print:hidden">
          <StatCard label="Cash paid" value={money(summary.cashPaid)} detail="received" />
          <StatCard label="Cheque paid" value={money(summary.chequePaid)} detail="received" />
          <StatCard label="Credit given" value={money(summary.creditGiven)} detail="sales credit" />
          <StatCard label="Transactions" value={summary.transactionCount} detail={money(summary.transactionTotal)} />
          <StatCard label="Order payments" value={summary.linkedPaymentCount} detail={money(summary.linkedPaymentTotal)} />
          <StatCard label="Aging" value={summary.agingBucket} detail={`${summary.daysOutstanding} days`} />
          <StatCard label="Collection cover" value={`${summary.collectionCoverageRate}%`} detail={money(summary.collectionTotal)} />
          <StatCard label="Follow-up due" value={summary.followUpDueDate || "-"} detail={summary.collectionPriority} />
        </div>

        <div className={`mt-5 rounded-lg border p-4 print:hidden ${collectionPriorityClass(summary.collectionPriority)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-[0.16em]">
              Collection priority: {summary.collectionPriority}
            </p>
            <p className="text-sm font-bold">Due {summary.followUpDueDate || "cleared"}</p>
          </div>
          <p className="mt-2 text-sm font-semibold">{summary.nextAction}</p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr] print:hidden">
          <form action={updateCustomerLedgerAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h2 className="font-black text-brand-green-ink">Customer details</h2>
            <input type="hidden" name="id" value={ledger.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input name="customerName" required className={inputClass} defaultValue={ledger.customerName} aria-label="Customer name" />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="phone" className={inputClass} defaultValue={ledger.phone} aria-label="Phone" />
              <select name="channel" className={inputClass} defaultValue={ledger.channel} aria-label="Channel">
                <option>Wholesale</option>
                <option>Retail</option>
                <option>Online</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input name="cashPaid" type="number" min="0" className={inputClass} defaultValue={ledger.cashPaid} aria-label="Cash paid" />
              <input name="chequePaid" type="number" min="0" className={inputClass} defaultValue={ledger.chequePaid} aria-label="Cheque paid" />
              <input name="creditGiven" type="number" min="0" className={inputClass} defaultValue={ledger.creditGiven} aria-label="Credit given" />
              <input name="balanceDue" type="number" min="0" className={inputClass} defaultValue={ledger.balanceDue} aria-label="Balance due" />
              <input name="creditLimit" type="number" min="0" className={inputClass} defaultValue={ledger.creditLimit} aria-label="Credit limit (0 = no limit)" placeholder="Credit limit (0 = no limit)" />
            </div>
            <FormSubmitButton className="h-10 rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
              Save customer
            </FormSubmitButton>
          </form>

          <form action={createLedgerTransactionAction} className="grid gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <h2 className="font-black text-brand-green-ink">New transaction</h2>
            <input type="hidden" name="ledgerId" value={ledger.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <select name="type" className={inputClass} defaultValue="Cash Payment">
              <option>Cash Payment</option>
              <option>Cheque Payment</option>
              <option>Credit Sale</option>
              <option>Return Adjustment</option>
              <option>Manual Adjustment</option>
            </select>
            <input name="amount" type="number" min="1" required className={inputClass} placeholder="Amount" />
            <textarea name="note" className={textareaClass} placeholder="Bill number, cheque number, return note, or remark" />
            <FormSubmitButton className="h-10 rounded-full bg-brand-green px-4 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
              Record transaction
            </FormSubmitButton>
          </form>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Transaction history</h2>
              <p className="mt-1 text-sm text-gray-500">
                Customer-wise cash, cheque, credit, return, and balance adjustment trail.
              </p>
            </div>
            <p className="text-sm font-bold text-brand-clay">Current due: {money(summary.balanceDue)}</p>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No transaction has been recorded for this customer yet.
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
                    <th className="py-2 pr-3">Note</th>
                    <th className="py-2 pr-3 print:hidden">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="py-3 pr-3 text-xs text-gray-500">{formatDate(transaction.createdAt)}</td>
                      <td className="py-3 pr-3 font-semibold text-brand-green-ink">{transaction.type}</td>
                      <td className="py-3 pr-3">
                        <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-bold text-brand-green">
                          {transactionEffect(transaction.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                      <td className="max-w-80 py-3 pr-3 text-gray-600">{transaction.note || "-"}</td>
                      <td className="py-3 pr-3 print:hidden">
                        <form action={deleteOperationRecordAction}>
                          <input type="hidden" name="kind" value="ledgerTransaction" />
                          <input type="hidden" name="id" value={transaction.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <ConfirmDeleteButton label="Delete" />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-black text-brand-green-ink">Linked order payments</h2>
            <p className="mt-1 text-sm text-gray-500">
              Order payment records connected to this ledger.
            </p>
          </div>

          {paymentTransactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No order payment has been linked to this ledger yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 pr-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="py-3 pr-3 text-xs text-gray-500">{formatDate(transaction.createdAt)}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-brand-green-ink">{transaction.orderId}</td>
                      <td className="py-3 pr-3 font-semibold text-brand-green-ink">{transaction.paymentStatus}</td>
                      <td className="py-3 pr-3">{transaction.paymentProvider.toUpperCase()}</td>
                      <td className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                      <td className="max-w-56 py-3 pr-3 text-gray-600">
                        {transaction.paymentTransactionId || transaction.paymentReference || "-"}
                      </td>
                      <td className="max-w-72 py-3 pr-3 text-gray-600">{transaction.note || "-"}</td>
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
