import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminPermissionSummary, getSessionAdminRole } from "@/lib/admin-permissions";
import { getCostingSnapshot } from "@/lib/costing";
import { getSafeDataBackendStatus } from "@/lib/data-backend";
import { getHrSnapshot } from "@/lib/hr";
import { getOperationalAlertCenter, type OperationalAlertSeverity } from "@/lib/notifications";
import { getOperationsSnapshot } from "@/lib/operations";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import { getPaymentReconciliation } from "@/lib/payment-reconciliation";
import { getPosSnapshot } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { formatPrice } from "@/lib/products";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import {
  getProductionReadinessWithData,
  summarizeProductionReadiness,
  type ReadinessStatus,
} from "@/lib/production-readiness";
import { getContactMessages, getOrders } from "@/lib/submissions";

export const dynamic = "force-dynamic";

type Tone = "default" | "good" | "warn" | "danger";

function amountFromOrderTotal(total: string) {
  return parseOrderTotalRupees(total);
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(999, Math.round((value / total) * 100));
}

function toneClass(tone: Tone) {
  if (tone === "good") {
    return "border-brand-green-line bg-brand-green-wash text-brand-green";
  }

  if (tone === "warn") {
    return "border-[#F4DEAE] bg-[#FFF9EA] text-brand-gold-ink";
  }

  if (tone === "danger") {
    return "border-[#F1C4BE] bg-[#FFF4F2] text-brand-clay";
  }

  return "border-gray-200 bg-white text-brand-green-ink";
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${toneClass(tone)}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-65">
        {detail}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function statusTone(status: ReadinessStatus) {
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "blocked") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusLabel(status: ReadinessStatus) {
  if (status === "ready") return "Ready";
  if (status === "blocked") return "Blocked";
  return "Warning";
}

function alertTone(severity: OperationalAlertSeverity): Tone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warn";
  return "good";
}

function collectionPriorityTone(priority: string): Tone {
  if (priority === "Urgent" || priority === "High") {
    return "danger";
  }

  if (priority === "Medium" || priority === "Monitor") {
    return "warn";
  }

  return "good";
}

function ReadinessPill({ status }: { status: ReadinessStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function StatusBadge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${toneClass(tone)}`}>
      {label}
    </span>
  );
}

function CommandLine({ value }: { value: string }) {
  return (
    <code className="block overflow-x-auto rounded-md bg-brand-green-ink px-3 py-2 text-xs font-semibold text-white">
      {value}
    </code>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-gray-100">
      <div
        className="h-2 rounded-full bg-brand-green"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-black text-brand-green-ink">{value}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  const [products, orders, messages, operations, paymentReconciliation, pos, purchasing, costing, hr] = await Promise.all([
    getProducts({ includeDrafts: true }),
    getOrders(),
    getContactMessages(),
    getOperationsSnapshot(),
    getPaymentReconciliation(),
    getPosSnapshot(),
    getPurchasingSnapshot(),
    getCostingSnapshot(),
    getHrSnapshot(),
  ]);
  const alertCenter = await getOperationalAlertCenter();
  const readiness = await getProductionReadinessWithData();
  const readinessSummary = summarizeProductionReadiness(readiness);
  const adminAccess = getAdminPermissionSummary(getSessionAdminRole(session));
  const allowedPermissionCount = adminAccess.permissions.filter((permission) => permission.allowed).length;
  const backendStatus = getSafeDataBackendStatus();
  const databaseCheck = readiness.find((check) => check.id === "database");
  const paymentCheck = readiness.find((check) => check.id === "payment");
  const activeProducts = products.filter((product) => product.status === "Active");
  const draftProducts = products.length - activeProducts.length;
  const lowStockProducts = products.filter((product) => product.stock <= 5);
  // Every design, out-of-stock first, so a glance answers both "what do I have"
  // and "what needs buying".
  const stockOverview = [...products].sort(
    (a, b) => a.stock - b.stock || a.name.localeCompare(b.name),
  );
  const pendingReviews = products.flatMap((product) => product.reviews).filter((review) => review.status === "pending");
  const catalogStockValue = products.reduce((total, product) => total + product.priceValue * product.stock, 0);
  const orderTotal = orders.reduce((total, order) => total + amountFromOrderTotal(order.total), 0);
  const newOrders = orders.filter((order) => order.status === "New");
  const pendingPayments = orders.filter((order) => order.paymentStatus === "Pending");
  const unpaidOrders = orders.filter((order) => order.paymentStatus === "Unpaid");
  const openMessages = messages.filter((message) => message.status === "New");
  const productionCompletion = percentage(operations.summary.finishedPairs, operations.summary.plannedPairs);
  const paymentIssueTone = paymentReconciliation.summary.highRiskIssueCount > 0
    ? "danger"
    : paymentReconciliation.summary.issueCount > 0
      ? "warn"
      : "good";
  const launchStatus =
    readinessSummary.launchReady ? "ready" : readinessSummary.blocked > 0 ? "blocked" : "warning";
  const collectionQueue = operations.reports.ledgerCollectionFollowups.filter(
    (ledger) => ledger.priority !== "Clear",
  );

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">KRISHOE operating dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Factory, wholesale, retail, online, payments, and launch safety overview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/api/admin/readiness"
            className="rounded-full border border-brand-green px-4 py-2 text-sm font-bold text-brand-green"
          >
            Readiness JSON
          </Link>
          <Link
            href="/admin/activity"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-brand-green-ink"
          >
            Activity log
          </Link>
          <Link
            href="/api/admin/backup"
            className="rounded-full bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            Export backup
          </Link>
        </div>
      </div>

      {/* The first thing on opening the admin: today's money and what is owed,
          in a glance, so the day starts with the numbers that matter. */}
      <section className="mt-6 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">Today at a glance</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Today sales", value: money(pos.summary.todayNetSales), tone: "good" as const, href: undefined as string | undefined },
            { label: "Today purchase", value: money(purchasing.summary.todayPurchase), tone: "plain" as const, href: undefined as string | undefined },
            { label: "Cash in hand", value: money(pos.todayDayClose.cashAmount), tone: "plain" as const, href: undefined as string | undefined },
            {
              label: "To collect",
              value: money(operations.summary.receivable),
              tone: operations.summary.receivable > 0 ? ("warn" as const) : ("good" as const),
              href: "/admin/dues",
            },
            {
              label: "To pay",
              value: money(purchasing.summary.supplierDue),
              tone: purchasing.summary.supplierDue > 0 ? ("warn" as const) : ("good" as const),
              href: "/admin/dues",
            },
          ].map((cell) => {
            const body = (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">{cell.label}</p>
                <p
                  className={`mt-1 text-lg font-black ${
                    cell.tone === "good"
                      ? "text-brand-green"
                      : cell.tone === "warn"
                        ? "text-brand-clay"
                        : "text-brand-green-ink"
                  }`}
                >
                  {cell.value}
                </p>
              </>
            );

            // The two dues cells open the full Dues list — the main way a phone
            // user (no sidebar) reaches it.
            return cell.href ? (
              <Link
                key={cell.label}
                href={cell.href}
                className="rounded-xl border border-brand-green/10 bg-white p-4 transition hover:border-brand-green/40 hover:shadow-sm"
              >
                {body}
              </Link>
            ) : (
              <div key={cell.label} className="rounded-xl border border-brand-green/10 bg-white p-4">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Sales pipeline" value={money(orderTotal)} detail={`${orders.length} orders`} />
        <StatCard label="POS today" value={money(pos.summary.todayNetSales)} detail={`${pos.summary.needsReview} needs review`} tone={pos.summary.needsReview > 0 ? "warn" : "good"} />
        <StatCard
          label="Payment review"
          value={paymentReconciliation.summary.issueCount}
          detail={`${paymentReconciliation.summary.highRiskIssueCount} high risk`}
          tone={paymentIssueTone}
        />
        <StatCard label="Alert center" value={alertCenter.summary.total} detail={`${alertCenter.summary.critical} critical alerts`} tone={alertCenter.summary.critical > 0 ? "danger" : alertCenter.summary.warning > 0 ? "warn" : "good"} />
        <StatCard label="Factory completion" value={`${productionCompletion}%`} detail={`${operations.summary.finishedPairs}/${operations.summary.plannedPairs} pairs`} tone="good" />
        <StatCard label="Receivable" value={money(operations.summary.receivable + pos.summary.totalCredit)} detail={`${operations.reports.ledgerCollectionSummary.urgentCount} urgent follow-up`} tone={operations.summary.receivable + pos.summary.totalCredit > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Catalog stock value" value={formatPrice(catalogStockValue)} detail={`${activeProducts.length} active, ${draftProducts} draft`} />
        <StatCard label="Purchase month" value={money(purchasing.summary.monthPurchase)} detail={`${money(purchasing.summary.supplierDue)} due, ${purchasing.summary.supplierImmediatePaymentCount} immediate`} tone={purchasing.summary.supplierDue > 0 ? "warn" : "good"} />
        <StatCard label="Finished stock" value={operations.summary.stockPairs} detail={`${operations.summary.soldPairs} sold pairs`} />
        <StatCard label="Profit signal" value={money(purchasing.summary.monthProfitEstimate)} detail="POS minus purchases" tone={purchasing.summary.monthProfitEstimate >= 0 ? "good" : "danger"} />
        <StatCard label="Design gross profit" value={money(costing.summary.grossProfit)} detail={`${costing.summary.grossMarginRate}% full COGS margin`} tone={costing.summary.grossProfit >= 0 ? "good" : "danger"} />
        <StatCard label="HR payroll" value={money(hr.summary.monthPayroll)} detail={`${hr.summary.activeEmployees} active staff`} tone={hr.summary.draftPayroll > 0 ? "warn" : "good"} />
        <StatCard label="Open queue" value={newOrders.length + openMessages.length} detail={`${newOrders.length} orders, ${openMessages.length} messages`} tone={newOrders.length + openMessages.length > 0 ? "warn" : "good"} />
        <StatCard label="Admin role" value={adminAccess.role} detail={`${allowedPermissionCount}/${adminAccess.permissions.length} permissions`} tone={adminAccess.role === "Owner" ? "good" : "warn"} />
        <StatCard label="Launch readiness" value={`${readinessSummary.ready}/${readinessSummary.total}`} detail={`${readinessSummary.blocked} blocked, ${readinessSummary.warnings} warning`} tone={launchStatus === "ready" ? "good" : launchStatus === "blocked" ? "danger" : "warn"} />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Stock at a glance</h2>
            <p className="mt-1 text-sm text-gray-500">
              Every design with the pairs on hand and its price. What is out of stock shows first.
            </p>
          </div>
          <Link
            href="/admin/products"
            className="text-sm font-bold text-brand-green underline underline-offset-4"
          >
            Manage products
          </Link>
        </div>

        {stockOverview.length === 0 ? (
          <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            No products yet. Buy or make some from Purchasing.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {stockOverview.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-green-ink">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.price}
                    {product.status === "Draft" ? " · Draft" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                    product.stock > 0
                      ? "bg-brand-green-tint text-brand-green"
                      : "bg-brand-clay-tint text-brand-clay"
                  }`}
                >
                  {product.stock > 0 ? `${product.stock} pairs` : "Out"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Today control room"
            detail="Orders, payment risk, messages, and low-stock action queue."
            action={
              <Link href="/admin/orders" className="text-sm font-bold text-brand-green underline underline-offset-4">
                Open orders
              </Link>
            }
          />
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="New orders" value={newOrders.length} />
            <MiniMetric label="Pending payments" value={pendingPayments.length} />
            <MiniMetric label="Unpaid orders" value={unpaidOrders.length} />
            <MiniMetric label="Unread messages" value={openMessages.length} />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-3 font-mono text-xs text-brand-green-ink">{order.id}</td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-brand-green-ink">{order.name}</p>
                      <p className="text-xs text-gray-500">{order.phone}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        label={order.paymentStatus}
                        tone={order.paymentStatus === "Paid" ? "good" : order.paymentStatus === "Failed" ? "danger" : "warn"}
                      />
                    </td>
                    <td className="py-3 pr-3 font-bold">{order.total}</td>
                    <td className="py-3 pr-3 text-gray-600">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Operational alert center"
            detail="Highest priority actions from payment, stock, collection, supplier, POS, and purchasing."
            action={
              <Link href="/admin/notifications" className="text-sm font-bold text-brand-green underline underline-offset-4">
                Open alerts
              </Link>
            }
          />
          <div className="grid gap-3 md:grid-cols-3">
            <MiniMetric label="Critical" value={alertCenter.summary.critical} />
            <MiniMetric label="Warning" value={alertCenter.summary.warning} />
            <MiniMetric label="Total" value={alertCenter.summary.total} />
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {alertCenter.alerts.slice(0, 5).map((alert) => (
              <Link key={alert.id} href={alert.href} className="block py-3 transition hover:text-brand-green">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{alert.title}</p>
                  <StatusBadge label={alert.severity} tone={alertTone(alert.severity)} />
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{alert.detail}</p>
              </Link>
            ))}
            {alertCenter.alerts.length === 0 ? (
              <p className="py-3 text-sm font-semibold text-brand-green">No operational alert is active.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Factory signal" detail="Production, dispatch, material, and worker progress." />
          <div className="grid gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-bold text-brand-green-ink">Production completion</span>
                <span className="font-black text-brand-green">{productionCompletion}%</span>
              </div>
              <ProgressBar value={productionCompletion} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Work in progress" value={operations.summary.inProgressPairs} />
              <MiniMetric label="Rejected pairs" value={operations.summary.rejectedPairs} />
              <MiniMetric label="Dispatch loaded" value={operations.reports.dispatchItemTotals.loadedPairs} />
              <MiniMetric label="Dispatch sold" value={operations.reports.dispatchItemTotals.soldPairs} />
            </div>
            {operations.reports.productionInsights.slice(0, 3).map((batch) => (
              <div key={batch.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{batch.design}</p>
                  <span className="text-xs font-bold text-gray-500">{batch.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Production {batch.productionCompletionRate}% | Worker {batch.workerProgressRate}% | Reject {batch.rejectRate}%
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Stock and demand" detail="Fast movers, slow movers, low product stock." />
          <div className="grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-green">Fast moving</p>
              {operations.fastMovingStock.slice(0, 3).map((stock) => (
                <p key={stock.id} className="mt-2 text-sm text-gray-700">
                  {stock.design}: <span className="font-bold">{stock.soldPairs}</span> sold
                </p>
              ))}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-clay">Low catalog stock</p>
              {lowStockProducts.slice(0, 4).map((product) => (
                <p key={product.id} className="mt-2 text-sm text-gray-700">
                  {product.name}: <span className="font-bold">{product.stock}</span> pairs
                </p>
              ))}
              {lowStockProducts.length === 0 ? (
                <p className="mt-2 text-sm font-semibold text-brand-green">No low catalog stock.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Ledger and collection" detail="Receivable aging and market collection quality." />
          <div className="grid gap-3">
            <MiniMetric label="Cash collected" value={money(operations.summary.cash)} />
            <MiniMetric label="Cheque collected" value={money(operations.summary.cheque)} />
            <MiniMetric label="Credit in market" value={money(operations.summary.credit)} />
            <MiniMetric label="This week due" value={money(operations.reports.ledgerCollectionSummary.dueThisWeek)} />
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {collectionQueue.slice(0, 4).map((ledger) => (
              <Link
                key={ledger.id}
                href={`/admin/operations/ledger/${ledger.id}`}
                className="grid gap-2 py-2 text-sm transition hover:text-brand-green"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-brand-green-ink">{ledger.customerName}</span>
                  <StatusBadge label={ledger.priority} tone={collectionPriorityTone(ledger.priority)} />
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  {money(ledger.balanceDue)} | {ledger.daysOutstanding} days | due {ledger.followUpDueDate || "-"}
                </span>
              </Link>
            ))}
            {collectionQueue.length === 0 ? (
              <p className="py-2 text-sm font-semibold text-brand-green">No collection follow-up is due.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle
            title="Production readiness"
            detail={`${readinessSummary.ready}/${readinessSummary.total} ready, ${readinessSummary.warnings} warning, ${readinessSummary.blocked} blocked.`}
            action={<ReadinessPill status={launchStatus} />}
          />
          <div className="divide-y divide-gray-100">
            {readiness.map((check) => (
              <div key={check.id} className="grid gap-3 py-3 md:grid-cols-[170px_100px_1fr]">
                <p className="text-sm font-black text-brand-green-ink">{check.label}</p>
                <div>
                  <ReadinessPill status={check.status} />
                </div>
                <div>
                  <p className="text-sm leading-6 text-gray-600">{check.detail}</p>
                  {check.envKeys.length > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-gray-400">{check.envKeys.join(", ")}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionTitle title="Database and launch actions" detail="Migration commands and key environment status." />
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <span className="font-semibold text-gray-500">Backend</span>
              <span className="font-black text-brand-green-ink">{backendStatus.backend}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <span className="font-semibold text-gray-500">Postgres adapters</span>
              <span className="font-black text-brand-green-ink">{backendStatus.postgresAdapterStatus}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <span className="font-semibold text-gray-500">DATABASE_URL</span>
              <ReadinessPill status={backendStatus.databaseUrlConfigured ? "ready" : "warning"} />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <span className="font-semibold text-gray-500">Payment mode</span>
              <ReadinessPill status={paymentCheck?.status ?? "warning"} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-gray-500">Pending reviews</span>
              <span className="font-black text-brand-green-ink">{pendingReviews.length}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <CommandLine value='DATABASE_URL="postgres://..." npm run db:schema' />
            <CommandLine value='DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v13.json --replace --confirm-replace' />
            <CommandLine value='DATABASE_URL="postgres://..." npm run db:smoke -- ./krishoe-backup-v13.json' />
          </div>

          {databaseCheck ? (
            <p className="mt-4 text-sm leading-6 text-gray-600">{databaseCheck.detail}</p>
          ) : null}
        </section>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["/admin/pos", "POS billing", "Create retail, wholesale, online bills with stock and ledger posting."],
          ["/admin/purchasing", "Purchasing", "Track raw material purchases, supplier due, and profit signal."],
          ["/admin/costing", "COGS and design profit", "Review material rates, batch cost, and design gross margin."],
          ["/admin/hr", "HR and worker performance", "Track staff, attendance, payroll, and production-task output."],
          ["/admin/operations", "Factory operations", "Track production, raw material, vehicles, and ledger."],
          ["/admin/products", "Manage products", "Review the local product catalog."],
          ["/admin/orders", "View orders", "Track submitted customer order requests."],
          ["/admin/payments", "Reconcile payments", "Audit orders, payment transactions, callbacks, and ledger links."],
          ["/admin/notifications", "Notifications", "Review live alert delivery for orders and contact messages."],
          ["/admin/settings", "Company settings", "Manage branches, staff accounts, roles, and admin access."],
          ["/admin/reviews", "Moderate reviews", "Approve, reject, or delete customer product reviews."],
          ["/admin/activity", "Activity log", "Review admin login, backup, product, order, and operations history."],
          ["/admin/messages", "Read messages", "Check customer contact form submissions."],
        ].map(([href, title, detail]) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-green"
          >
            <h2 className="font-black text-brand-green-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
