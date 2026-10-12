import Link from "next/link";
import T from "@/components/T";
import { PageHead, PageTabs, StatStrip } from "@/components/admin/PageKit";
import { money } from "@/lib/format-money";
import { getPaymentReconciliation, type PaymentReconciliationIssueSeverity } from "@/lib/payment-reconciliation";
import { DateDisplayAdmin } from "@/components/DateDisplay";

export const metadata = {
  title: "Payment Reconciliation | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function severityClass(severity: PaymentReconciliationIssueSeverity) {
  if (severity === "high") {
    return "bg-brand-clay-tint text-brand-clay";
  }

  if (severity === "medium") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-brand-mist text-brand-muted-deep";
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

  return "bg-brand-mist text-brand-muted-deep";
}

const SEVERITY: Record<string, { ne: string }> = { high: { ne: "धेरै" }, medium: { ne: "मध्यम" }, low: { ne: "थोरै" } };
const STATUS: Record<string, { ne: string }> = {
  Paid: { ne: "तिरेको" },
  Pending: { ne: "आउन बाँकी" },
  Unpaid: { ne: "नतिरेको" },
  Failed: { ne: "असफल" },
  Refunded: { ne: "फिर्ता गरेको" },
};

const exportLinks = [
  { en: "Issues", ne: "समस्या", href: "/api/admin/payments/reconciliation/export?type=issues" },
  { en: "Orders", ne: "अर्डर", href: "/api/admin/payments/reconciliation/export?type=orders" },
  { en: "Payments", ne: "भुक्तानी", href: "/api/admin/payments/reconciliation/export?type=transactions" },
  { en: "By channel", ne: "माध्यम अनुसार", href: "/api/admin/payments/reconciliation/export?type=providers" },
];

const cell = "py-3 pr-3";

/**
 * Payments matched against orders (owner, 2026-10-12: English but for seven
 * words, "reconciliation" and "transaction trail" for a shopkeeper, and the
 * rupees open while the dashboard hides them). Now in both languages, three
 * figures with the rupees behind the eye, and three tabs: what needs a look,
 * every payment, and by channel.
 */
export default async function AdminPaymentsPage() {
  const reconciliation = await getPaymentReconciliation();
  const { summary } = reconciliation;

  const review = (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            <T en="Needs a look" ne="हेर्नुपर्ने" />
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            <T en="Payments and orders that do not agree." ne="भुक्तानी र अर्डर नमिलेका।" />
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          <T en="Open orders" ne="अर्डर हेर्ने" />
        </Link>
      </div>
      {reconciliation.issues.length === 0 ? (
        <p className="rounded-lg border border-brand-green-line bg-brand-green-wash p-4 text-sm font-semibold text-brand-green">
          <T en="Everything matches ✓" ne="सबै मिलेको छ ✓" />
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="reflow-table min-w-full text-sm">
            <thead className="border-b text-left text-brand-muted">
              <tr>
                <th className="py-2 pr-3"><T en="Risk" ne="जोखिम" /></th>
                <th className="py-2 pr-3"><T en="What" ne="के" /></th>
                <th className="py-2 pr-3"><T en="Customer" ne="ग्राहक" /></th>
                <th className="py-2 pr-3"><T en="Amount" ne="रकम" /></th>
                <th className="py-2 pr-3"><T en="What to do" ne="के गर्ने" /></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reconciliation.issues.slice(0, 12).map((issue) => (
                <tr key={issue.id}>
                  <td className={`reflow-primary ${cell}`}>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityClass(issue.severity)}`}>
                      <T en={issue.severity} ne={SEVERITY[issue.severity]?.ne ?? issue.severity} />
                    </span>
                  </td>
                  <td data-label="What" data-label-ne="के" className={`min-w-72 ${cell}`}>
                    <p className="font-bold text-brand-green-ink">{issue.type}</p>
                    <p className="mt-1 text-xs text-brand-muted">{issue.detail}</p>
                    {issue.orderId ? <p className="mt-1 font-mono text-xs text-brand-muted-soft">{issue.orderId}</p> : null}
                  </td>
                  <td data-label="Customer" data-label-ne="ग्राहक" className={`${cell} font-semibold text-brand-green-ink`}>{issue.customerName}</td>
                  <td data-label="Amount" data-label-ne="रकम" className={`${cell} font-bold`}>{money(issue.amount)}</td>
                  <td data-label="What to do" data-label-ne="के गर्ने" className={`min-w-64 ${cell} text-xs font-semibold text-brand-muted`}>
                    {issue.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const all = (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">
        <T en="Every payment" ne="सबै भुक्तानी" />
      </h2>
      <p className="mt-1 text-sm text-brand-muted">
        <T en="The latest payments, from the counter, the system and eSewa / Khalti." ne="पछिल्ला भुक्तानी: काउन्टर, system र eSewa / Khalti बाट।" />
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="reflow-table min-w-full text-sm">
          <thead className="border-b text-left text-brand-muted">
            <tr>
              <th className="py-2 pr-3"><T en="Date" ne="मिति" /></th>
              <th className="py-2 pr-3"><T en="Order" ne="अर्डर" /></th>
              <th className="py-2 pr-3"><T en="Customer" ne="ग्राहक" /></th>
              <th className="py-2 pr-3"><T en="Channel" ne="माध्यम" /></th>
              <th className="py-2 pr-3"><T en="Status" ne="अवस्था" /></th>
              <th className="py-2 pr-3"><T en="Amount" ne="रकम" /></th>
              <th className="py-2 pr-3"><T en="Source" ne="कहाँबाट" /></th>
              <th className="py-2 pr-3"><T en="Reference" ne="सन्दर्भ" /></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reconciliation.transactions.slice(0, 20).map((transaction) => (
              <tr key={transaction.id}>
                <td className={`reflow-primary whitespace-nowrap ${cell} text-xs text-brand-muted`}>
                  <DateDisplayAdmin date={transaction.createdAt} time />
                </td>
                <td data-label="Order" data-label-ne="अर्डर" className={cell}>
                  <p className="font-mono text-xs text-brand-green-ink">{transaction.orderId}</p>
                  {!transaction.orderExists ? (
                    <p className="text-xs font-bold text-brand-clay">
                      <T en="Missing order" ne="अर्डर भेटिएन" />
                    </p>
                  ) : null}
                </td>
                <td data-label="Customer" data-label-ne="ग्राहक" className={`${cell} font-semibold text-brand-green-ink`}>{transaction.customerName}</td>
                <td data-label="Channel" data-label-ne="माध्यम" className={`${cell} uppercase`}>{transaction.paymentProvider}</td>
                <td data-label="Status" data-label-ne="अवस्था" className={cell}>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(transaction.paymentStatus)}`}>
                    <T en={transaction.paymentStatus} ne={STATUS[transaction.paymentStatus]?.ne ?? transaction.paymentStatus} />
                  </span>
                </td>
                <td data-label="Amount" data-label-ne="रकम" className={`${cell} font-bold`}>{money(transaction.amount)}</td>
                <td data-label="Source" data-label-ne="कहाँबाट" className={cell}>{transaction.source}</td>
                <td data-label="Reference" data-label-ne="सन्दर्भ" className={`max-w-56 ${cell} text-xs text-brand-muted`}>
                  {transaction.paymentTransactionId || transaction.paymentReference || transaction.paymentCallbackId || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const byChannel = (
    <section className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">
        <T en="By channel" ne="माध्यम अनुसार" />
      </h2>
      <p className="mt-1 text-sm text-brand-muted">
        <T en="What the orders asked for, and what came in, by channel." ne="अर्डरको रकम र आएको रकम, माध्यम अनुसार।" />
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {reconciliation.providers.map((provider) => (
          <div key={provider.provider} className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black uppercase text-brand-green-ink">{provider.provider}</p>
              <p className="text-xs font-bold text-brand-muted">
                <T en={`${provider.transactionCount} payments`} ne={`${provider.transactionCount} भुक्तानी`} />
              </p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold text-brand-muted">
              <p>
                <T en={`Orders: ${money(provider.orderAmount)}`} ne={`अर्डर: ${money(provider.orderAmount)}`} />
              </p>
              <p>
                <T en={`Recorded: ${money(provider.transactionAmount)}`} ne={`टिपिएको: ${money(provider.transactionAmount)}`} />
              </p>
              <p className="text-brand-green">
                <T en={`Paid: ${money(provider.paidAmount)}`} ne={`तिरेको: ${money(provider.paidAmount)}`} />
              </p>
              <p className="text-brand-gold-ink">
                <T en={`To come: ${money(provider.pendingAmount)}`} ne={`आउन बाँकी: ${money(provider.pendingAmount)}`} />
              </p>
            </div>
          </div>
        ))}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-black text-brand-green">
          ⬇ <T en="Download as CSV (4)" ne="CSV मा डाउनलोड (४)" />
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {exportLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
            >
              <T en={link.en} ne={link.ne} />
            </a>
          ))}
        </div>
      </details>
    </section>
  );

  return (
    <section className="p-4 sm:p-6">
      <PageHead eyebrow={<T en="Money" ne="पैसा" />} title={<T en="Payments" ne="भुक्तानी" />} />
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <T
          en="Every payment matched against its order, before sending or closing the month."
          ne="पठाउनुअघि वा महिना बन्द गर्नुअघि, हरेक भुक्तानी त्यसको अर्डरसँग मिलाउने।"
        />
      </p>

      <div className="mt-4">
        <StatStrip
          items={[
            { en: "orders asked", ne: "अर्डरको रकम", value: summary.orderAmount, money: true },
            { en: "paid in", ne: "आएको", value: summary.paidTransactionAmount, money: true },
            {
              en: "to look at",
              ne: "हेर्नुपर्ने",
              value: summary.issueCount,
              tone: summary.highRiskIssueCount > 0 ? "warn" : summary.issueCount === 0 ? "good" : undefined,
            },
          ]}
        />
        <p className="mt-2 text-xs font-bold text-brand-muted">
          <T
            en={`${summary.orderCount} ${summary.orderCount === 1 ? "order" : "orders"} · ${summary.transactionCount} ${summary.transactionCount === 1 ? "payment" : "payments"} recorded · ${summary.gatewayTransactionCount} from eSewa / Khalti · ${summary.highRiskIssueCount} high risk`}
            ne={`${summary.orderCount} अर्डर · ${summary.transactionCount} भुक्तानी टिपिएको · eSewa / Khalti बाट ${summary.gatewayTransactionCount} · धेरै जोखिम ${summary.highRiskIssueCount}`}
          />
        </p>
      </div>

      <div className="mt-5">
        <PageTabs
          id="payments"
          tabs={[
            { key: "review", en: "⚠ Needs a look", ne: "⚠ हेर्नुपर्ने", count: summary.issueCount, content: review },
            { key: "all", en: "📜 Every payment", ne: "📜 सबै भुक्तानी", content: all },
            { key: "channel", en: "🏦 By channel", ne: "🏦 माध्यम अनुसार", content: byChannel },
          ]}
        />
      </div>
    </section>
  );
}
