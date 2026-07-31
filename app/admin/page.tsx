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
import { isLowOrOut } from "@/lib/stock-thresholds";
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
  if (total <= 0) return 0;
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

// Safe data fetching with fallbacks
async function safeGetData() {
  const session = await getAdminSession();

  // Fetch all data with error handling
  const results = await Promise.allSettled([
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

  const [products, orders, messages, operations, paymentReconciliation, pos, purchasing, costing, hr] =
    results.map((r) => (r.status === "fulfilled" ? r.value : null));

  const alertCenter = (await getOperationalAlertCenter().catch(() => null)) ?? null;
  const readiness = (await getProductionReadinessWithData().catch(() => [])) ?? [];

  return {
    session,
    products: (Array.isArray(products) ? products.filter((p) => p && "priceValue" in p) : []) as any[],
    orders: (Array.isArray(orders) ? orders.filter((o) => o && "id" in o && "total" in o) : []) as any[],
    messages: (Array.isArray(messages) ? messages.filter((m) => m && "id" in m) : []) as any[],
    operations: (operations ?? {}) as any,
    paymentReconciliation: (paymentReconciliation ?? {}) as any,
    pos: (pos ?? {}) as any,
    purchasing: (purchasing ?? {}) as any,
    costing: (costing ?? {}) as any,
    hr: (hr ?? {}) as any,
    alertCenter: (alertCenter ?? { summary: {}, alerts: [] }) as any,
    readiness,
  };
}

export default async function AdminDashboardPage() {
  const {
    session,
    products,
    orders,
    messages,
    operations,
    paymentReconciliation,
    pos,
    purchasing,
    costing,
    hr,
    alertCenter,
    readiness,
  } = await safeGetData();

  // Safe access to data with defaults
  const getOp = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = operations;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  const getPos = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = pos;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  const getPur = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = purchasing;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  const getCost = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = costing;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  const getHr = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = hr;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  const getAlert = (path: string, defaultVal: any = 0) => {
    const keys = path.split(".");
    let val: any = alertCenter;
    for (const key of keys) {
      val = val?.[key];
    }
    return val ?? defaultVal;
  };

  // Derived data
  const readinessSummary = summarizeProductionReadiness(readiness);
  const adminAccess = getAdminPermissionSummary(getSessionAdminRole(session));
  const allowedPermissionCount = adminAccess.permissions.filter((permission) => permission.allowed).length;
  const backendStatus = getSafeDataBackendStatus();
  const databaseCheck = readiness.find((check) => check.id === "database");
  const paymentCheck = readiness.find((check) => check.id === "payment");

  const activeProducts = products.filter((product) => product.status === "Active");
  const draftProducts = products.length - activeProducts.length;
  const lowStockProducts = products.filter((product) => isLowOrOut(product.stock));

  const stockOverview = [...products].sort((a, b) => {
    if (!a || !b) return 0;
    const stockDiff = (a.stock || 0) - (b.stock || 0);
    if (stockDiff !== 0) return stockDiff;
    if (a.name && b.name) return a.name.localeCompare(b.name);
    return 0;
  });

  const topEarners = (Array.isArray(getCost("designCosting")) ? getCost("designCosting") : [])
    .filter((row: any) => row && row.soldPairs > 0 && row.grossProfit > 0)
    .sort((a: any, b: any) => (b?.grossProfit || 0) - (a?.grossProfit || 0))
    .slice(0, 5);

  const pendingReviews = products.flatMap((product) => product.reviews || []).filter((review) => review?.status === "pending");
  const catalogStockValue = products.reduce((total, product) => total + (product?.priceValue || 0) * (product?.stock || 0), 0);

  const orderTotal = orders.reduce((total, order) => total + amountFromOrderTotal(order?.total || "0"), 0);
  const newOrders = orders.filter((order) => order?.status === "New");
  const pendingPayments = orders.filter((order) => order?.paymentStatus === "Pending");
  const unpaidOrders = orders.filter((order) => order?.paymentStatus === "Unpaid");

  const openMessages = messages.filter((message) => message?.status === "New");

  const productionCompletion = percentage(getOp("summary.finishedPairs", 0), getOp("summary.plannedPairs", 1));

  const paymentIssueTone =
    paymentReconciliation?.summary?.highRiskIssueCount > 0
      ? "danger"
      : paymentReconciliation?.summary?.issueCount > 0
        ? "warn"
        : "good";

  const launchStatus =
    readinessSummary.launchReady ? "ready" : readinessSummary.blocked > 0 ? "blocked" : "warning";

  const collectionQueue = (Array.isArray(getOp("reports.ledgerCollectionFollowups")) ? getOp("reports.ledgerCollectionFollowups") : []).filter(
    (ledger: any) => ledger?.priority !== "Clear",
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

      <section className="mt-6 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">Today at a glance</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Today sales", value: money(getPos("summary.todayNetSales", 0)), tone: "good" as const, href: undefined as string | undefined },
            { label: "Today purchase", value: money(getPur("summary.todayPurchase", 0)), tone: "plain" as const, href: undefined as string | undefined },
            { label: "Cash in hand", value: money(getPos("todayDayClose.cashAmount", 0)), tone: "plain" as const, href: undefined as string | undefined },
            {
              label: "To collect",
              value: money(getOp("summary.receivable", 0)),
              tone: getOp("summary.receivable", 0) > 0 ? ("warn" as const) : ("good" as const),
              href: "/admin/dues",
            },
            {
              label: "To pay",
              value: money(getPur("summary.supplierDue", 0)),
              tone: getPur("summary.supplierDue", 0) > 0 ? ("warn" as const) : ("good" as const),
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

      <section className="mt-6 rounded-2xl border border-brand-gold-bright/40 bg-brand-cream-soft/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-brand-green-ink">Profit at a glance</h2>
          <Link href="/admin/costing" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Costing detail
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Array.isArray(getCost("periodReports")) ? getCost("periodReports") : []).map((period: any) => (
            <div key={period?.label} className="rounded-xl border border-brand-green/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">{period?.label}</p>
              <p
                className={`mt-1 text-xl font-black ${
                  (period?.grossProfit || 0) >= 0 ? "text-brand-green" : "text-brand-clay"
                }`}
              >
                {money(period?.grossProfit || 0)}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                {period?.grossMarginRate || 0}% margin · {period?.soldPairs || 0} pairs
              </p>
            </div>
          ))}
        </div>
        {topEarners.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-muted">Top earning designs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topEarners.map((row: any) => (
                <span
                  key={row?.design}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-white px-3 py-1 text-xs font-bold text-brand-green-ink"
                >
                  {row?.design}
                  <span className="text-brand-green">{money(row?.grossProfit || 0)}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Sales pipeline" value={money(orderTotal)} detail={`${orders.length} orders`} />
        <StatCard label="POS today" value={money(getPos("summary.todayNetSales", 0))} detail={`${getPos("summary.needsReview", 0)} needs review`} tone={getPos("summary.needsReview", 0) > 0 ? "warn" : "good"} />
        <StatCard
          label="Payment review"
          value={paymentReconciliation?.summary?.issueCount || 0}
          detail={`${paymentReconciliation?.summary?.highRiskIssueCount || 0} high risk`}
          tone={paymentIssueTone}
        />
        <StatCard label="Alert center" value={getAlert("summary.total", 0)} detail={`${getAlert("summary.critical", 0)} critical alerts`} tone={getAlert("summary.critical", 0) > 0 ? "danger" : getAlert("summary.warning", 0) > 0 ? "warn" : "good"} />
        <StatCard label="Factory completion" value={`${productionCompletion}%`} detail={`${getOp("summary.finishedPairs", 0)}/${getOp("summary.plannedPairs", 0)} pairs`} tone="good" />
        <StatCard label="Receivable" value={money(getOp("summary.receivable", 0) + getPos("summary.totalCredit", 0))} detail={`${getOp("reports.ledgerCollectionSummary.urgentCount", 0)} urgent follow-up`} tone={getOp("summary.receivable", 0) + getPos("summary.totalCredit", 0) > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Catalog stock value" value={formatPrice(catalogStockValue)} detail={`${activeProducts.length} active, ${draftProducts} draft`} />
        <StatCard label="Purchase month" value={money(getPur("summary.monthPurchase", 0))} detail={`${money(getPur("summary.supplierDue", 0))} due, ${getPur("summary.supplierImmediatePaymentCount", 0)} immediate`} tone={getPur("summary.supplierDue", 0) > 0 ? "warn" : "good"} />
        <StatCard label="Finished stock" value={getOp("summary.stockPairs", 0)} detail={`${getOp("summary.soldPairs", 0)} sold pairs`} />
        <StatCard label="Profit signal" value={money(getPur("summary.monthProfitEstimate", 0))} detail="POS minus purchases" tone={getPur("summary.monthProfitEstimate", 0) >= 0 ? "good" : "danger"} />
        <StatCard label="Design gross profit" value={money(getCost("summary.grossProfit", 0))} detail={`${getCost("summary.grossMarginRate", 0)}% full COGS margin`} tone={getCost("summary.grossProfit", 0) >= 0 ? "good" : "danger"} />
        <StatCard label="HR payroll" value={money(getHr("summary.monthPayroll", 0))} detail={`${getHr("summary.activeEmployees", 0)} active staff`} tone={getHr("summary.draftPayroll", 0) > 0 ? "warn" : "good"} />
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
            <table className="reflow-table min-w-full text-sm">
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
                    <td className="reflow-primary py-3 pr-3 font-mono text-xs text-brand-green-ink">{order.id}</td>
                    <td data-label="Customer" className="py-3 pr-3">
                      <p className="font-semibold text-brand-green-ink">{order.name}</p>
                      <p className="text-xs text-gray-500">{order.phone}</p>
                    </td>
                    <td data-label="Payment" className="py-3 pr-3">
                      <StatusBadge
                        label={order.paymentStatus}
                        tone={order.paymentStatus === "Paid" ? "good" : order.paymentStatus === "Failed" ? "danger" : "warn"}
                      />
                    </td>
                    <td data-label="Total" className="py-3 pr-3 font-bold">{order.total}</td>
                    <td data-label="Status" className="py-3 pr-3 text-gray-600">{order.status}</td>
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
            <MiniMetric label="Critical" value={getAlert("summary.critical", 0)} />
            <MiniMetric label="Warning" value={getAlert("summary.warning", 0)} />
            <MiniMetric label="Total" value={getAlert("summary.total", 0)} />
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {(Array.isArray(getAlert("alerts")) ? getAlert("alerts") : []).slice(0, 5).map((alert: any) => (
              <Link key={alert?.id} href={alert?.href || "#"} className="block py-3 transition hover:text-brand-green">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{alert?.title || "Alert"}</p>
                  <StatusBadge label={alert?.severity || "info"} tone={alertTone(alert?.severity || "info")} />
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{alert?.detail || ""}</p>
              </Link>
            ))}
            {(Array.isArray(getAlert("alerts")) ? getAlert("alerts").length : 0) === 0 ? (
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
              <MiniMetric label="Work in progress" value={getOp("summary.inProgressPairs", 0)} />
              <MiniMetric label="Rejected pairs" value={getOp("summary.rejectedPairs", 0)} />
              <MiniMetric label="Dispatch loaded" value={getOp("reports.dispatchItemTotals.loadedPairs", 0)} />
              <MiniMetric label="Dispatch sold" value={getOp("reports.dispatchItemTotals.soldPairs", 0)} />
            </div>
            {(Array.isArray(getOp("reports.productionInsights")) ? getOp("reports.productionInsights") : []).slice(0, 3).map((batch: any) => (
              <div key={batch?.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{batch?.design}</p>
                  <span className="text-xs font-bold text-gray-500">{batch?.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Production {batch?.productionCompletionRate}% | Worker {batch?.workerProgressRate}% | Reject {batch?.rejectRate}%
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
              {(Array.isArray(getOp("fastMovingStock")) ? getOp("fastMovingStock") : []).slice(0, 3).map((stock: any) => (
                <p key={stock?.id} className="mt-2 text-sm text-gray-700">
                  {stock?.design}: <span className="font-bold">{stock?.soldPairs}</span> sold
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
            <MiniMetric label="Cash collected" value={money(getOp("summary.cash", 0))} />
            <MiniMetric label="Cheque collected" value={money(getOp("summary.cheque", 0))} />
            <MiniMetric label="Credit in market" value={money(getOp("summary.credit", 0))} />
            <MiniMetric label="This week due" value={money(getOp("reports.ledgerCollectionSummary.dueThisWeek", 0))} />
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {collectionQueue.slice(0, 4).map((ledger: any) => (
              <Link
                key={ledger?.id}
                href={`/admin/operations/ledger/${ledger?.id}`}
                className="grid gap-2 py-2 text-sm transition hover:text-brand-green"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-brand-green-ink">{ledger?.customerName}</span>
                  <StatusBadge label={ledger?.priority} tone={collectionPriorityTone(ledger?.priority)} />
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  {money(ledger?.balanceDue || 0)} | {ledger?.daysOutstanding} days | due {ledger?.followUpDueDate || "-"}
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
