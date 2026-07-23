import Link from "next/link";
import { getPaymentReconciliation, type PaymentReconciliationIssueSeverity } from "@/lib/payment-reconciliation";

export const metadata = {
  title: "Payment Reconciliation | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function severityClass(severity: PaymentReconciliationIssueSeverity) {
  if (severity === "high") {
    return "bg-brand-clay-tint text-brand-clay";
  }

  if (severity === "medium") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-gray-100 text-gray-700";
}

function statusClass(status: string) {
  if (status === "Paid") {
    return "bg-brand-green-tint text-brand-green";
  }

  if (status === "Failed" || status === "Refunded") {
    return "bg-brand-clay-tint text-brand-clay";
  }

  if (status === "Pending") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-gray-100 text-gray-700";
}

const exportLinks = [
  { label: "Issues CSV", href: "/api/admin/payments/reconciliation/export?type=issues" },
  { label: "Orders CSV", href: "/api/admin/payments/reconciliation/export?type=orders" },
  { label: "Transactions CSV", href: "/api/admin/payments/reconciliation/export?type=transactions" },
  { label: "Provider CSV", href: "/api/admin/payments/reconciliation/export?type=providers" },
];

export default async function AdminPaymentsPage() {
  const reconciliation = await getPaymentReconciliation();

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Payment reconciliation</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Match orders, payment transactions, gateway callbacks, and ledger links before dispatch or monthly closing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Order payment total" value={money(reconciliation.summary.orderAmount)} detail={`${reconciliation.summary.orderCount} orders`} />
        <StatCard label="Transaction total" value={money(reconciliation.summary.transactionAmount)} detail={`${reconciliation.summary.transactionCount} records`} />
        <StatCard label="Paid transaction" value={money(reconciliation.summary.paidTransactionAmount)} detail={`${reconciliation.summary.gatewayTransactionCount} gateway records`} />
        <StatCard label="Review issues" value={reconciliation.summary.issueCount} detail={`${reconciliation.summary.highRiskIssueCount} high risk`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Needs review</h2>
              <p className="mt-1 text-sm text-gray-500">High and medium risk mismatch signals.</p>
            </div>
            <Link
              href="/admin/orders"
              className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
            >
              Open orders
            </Link>
          </div>
          {reconciliation.issues.length === 0 ? (
            <p className="rounded-lg border border-brand-green-line bg-brand-green-wash p-4 text-sm font-semibold text-brand-green">
              No reconciliation issue detected.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="reflow-table min-w-full text-sm">
                <thead className="border-b text-left text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 pr-3">Issue</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reconciliation.issues.slice(0, 12).map((issue) => (
                    <tr key={issue.id}>
                      <td className="reflow-primary py-3 pr-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClass(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td data-label="Issue" className="min-w-72 py-3 pr-3">
                        <p className="font-bold text-brand-green-ink">{issue.type}</p>
                        <p className="mt-1 text-xs text-gray-500">{issue.detail}</p>
                        {issue.orderId ? <p className="mt-1 font-mono text-xs text-gray-400">{issue.orderId}</p> : null}
                      </td>
                      <td data-label="Customer" className="py-3 pr-3 font-semibold text-brand-green-ink">{issue.customerName}</td>
                      <td data-label="Amount" className="py-3 pr-3 font-bold">{money(issue.amount)}</td>
                      <td data-label="Action" className="min-w-64 py-3 pr-3 text-xs font-semibold text-gray-600">{issue.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">Provider summary</h2>
          <p className="mt-1 text-sm text-gray-500">Order vs transaction totals by payment channel.</p>
          <div className="mt-4 grid gap-3">
            {reconciliation.providers.map((provider) => (
              <div key={provider.provider} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black uppercase text-brand-green-ink">{provider.provider}</p>
                  <p className="text-xs font-bold text-gray-500">{provider.transactionCount} txns</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600">
                  <p>Orders: {money(provider.orderAmount)}</p>
                  <p>Txn: {money(provider.transactionAmount)}</p>
                  <p className="text-brand-green">Paid: {money(provider.paidAmount)}</p>
                  <p className="text-brand-gold-ink">Pending: {money(provider.pendingAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">Recent transaction trail</h2>
        <p className="mt-1 text-sm text-gray-500">Latest admin, system, and gateway payment records.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="reflow-table min-w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reconciliation.transactions.slice(0, 20).map((transaction) => (
                <tr key={transaction.id}>
                  <td className="reflow-primary whitespace-nowrap py-3 pr-3 text-xs text-gray-500">
                    {new Date(transaction.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td data-label="Order" className="py-3 pr-3">
                    <p className="font-mono text-xs text-brand-green-ink">{transaction.orderId}</p>
                    {!transaction.orderExists ? <p className="text-xs font-bold text-brand-clay">Missing order</p> : null}
                  </td>
                  <td data-label="Customer" className="py-3 pr-3 font-semibold text-brand-green-ink">{transaction.customerName}</td>
                  <td data-label="Provider" className="py-3 pr-3 uppercase">{transaction.paymentProvider}</td>
                  <td data-label="Status" className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(transaction.paymentStatus)}`}>
                      {transaction.paymentStatus}
                    </span>
                  </td>
                  <td data-label="Amount" className="py-3 pr-3 font-bold">{money(transaction.amount)}</td>
                  <td data-label="Source" className="py-3 pr-3">{transaction.source}</td>
                  <td data-label="Reference" className="max-w-56 py-3 pr-3 text-xs text-gray-600">
                    {transaction.paymentTransactionId || transaction.paymentReference || transaction.paymentCallbackId || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
