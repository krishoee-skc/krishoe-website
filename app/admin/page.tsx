import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon,
  CreditCardIcon,
  MessageSquareIcon,
  PackageIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  UserIcon,
} from "@/components/Icons";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminPermissionSummary, getSessionAdminRole, requireAdminPermission } from "@/lib/admin-permissions";
import { getCostingSnapshot } from "@/lib/costing";
import { getSafeDataBackendStatus } from "@/lib/data-backend";
import { getHrSnapshot } from "@/lib/hr";
import { getOperationalAlertCenter, type OperationalAlertSeverity } from "@/lib/notifications";
import { getOperationsSnapshot } from "@/lib/operations";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import { getPaymentReconciliation } from "@/lib/payment-reconciliation";
import { getPosSnapshot } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { formatPrice, type Product } from "@/lib/products";
import { isLowOrOut } from "@/lib/stock-thresholds";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import {
  getProductionReadinessWithData,
  summarizeProductionReadiness,
  type ReadinessStatus,
} from "@/lib/production-readiness";
import { getProductionControlSummary } from "@/lib/production-accounting";
import { getContactMessages, getOrders, type ContactSubmission, type OrderSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

type Tone = "default" | "good" | "warn" | "danger";
type OperationsSnapshot = Awaited<ReturnType<typeof getOperationsSnapshot>>;
type PaymentReconciliationSnapshot = Awaited<ReturnType<typeof getPaymentReconciliation>>;
type PosSnapshot = Awaited<ReturnType<typeof getPosSnapshot>>;
type PurchasingSnapshot = Awaited<ReturnType<typeof getPurchasingSnapshot>>;
type CostingSnapshot = Awaited<ReturnType<typeof getCostingSnapshot>>;
type HrSnapshot = Awaited<ReturnType<typeof getHrSnapshot>>;
type OperationalAlertCenter = Awaited<ReturnType<typeof getOperationalAlertCenter>>;
type ProductionControlSummary = Awaited<ReturnType<typeof getProductionControlSummary>>;
type DesignCostingRow = CostingSnapshot["designCosting"][number];
type CostingPeriodRow = CostingSnapshot["periodReports"][number];
type OperationalAlert = OperationalAlertCenter["alerts"][number];
type IconComponent = ComponentType<{ className?: string }>;
type RawMaterialRow = OperationsSnapshot["rawMaterials"][number];
type WorkerTaskRow = OperationsSnapshot["workerTasks"][number];
type ProductionBatchRow = OperationsSnapshot["productionBatches"][number];
type MaterialConsumptionRow = OperationsSnapshot["materialConsumptions"][number];
type SupplierPaymentFollowup = PurchasingSnapshot["reports"]["supplierPaymentFollowups"][number];
type PayrollSuggestionRow = HrSnapshot["reports"]["payrollSuggestions"][number];
type ProductionInsight = {
  id: string;
  design: string;
  status: string;
  productionCompletionRate: number;
  workerProgressRate: number;
  rejectRate: number;
};
type FastMovingStock = {
  id: string;
  design: string;
  soldPairs: number;
};
type CollectionFollowup = {
  id: string;
  customerName: string;
  priority: string;
  balanceDue: number;
  daysOutstanding: number;
  followUpDueDate?: string;
};

function emptyProductionControlSummary(): ProductionControlSummary {
  return {
    activeWorkOrders: 0,
    overdueWorkOrders: 0,
    readyForQc: 0,
    todayGoodPairs: 0,
    todayRejectedPairs: 0,
    todayEarnedWage: 0,
    todayStockPairs: 0,
    handoverMismatches: 0,
    workerBalanceDue: 0,
    stagePending: {},
  };
}

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
      <p className="admin-wide-value mt-2 text-3xl font-black">{value}</p>
      <p className="admin-wide-label mt-2 text-xs font-semibold uppercase opacity-65">
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

function ControlTile({
  href,
  label,
  value,
  detail,
  tone = "default",
  Icon,
}: {
  href: string;
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
  Icon: IconComponent;
}) {
  return (
    <Link
      href={href}
      className={`group grid min-h-[150px] grid-rows-[auto_1fr_auto] rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass(tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/75 text-current shadow-sm ring-1 ring-black/5 dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRightIcon className="h-4 w-4 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
      </div>
      <div className="mt-4">
        <p className="admin-wide-label text-xs font-black uppercase opacity-65">{label}</p>
        <p className="admin-wide-value mt-2 text-2xl font-black leading-none">{value}</p>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 opacity-75">{detail}</p>
    </Link>
  );
}

function QuickCommand({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: IconComponent;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-green/20 bg-white px-3 text-sm font-black text-brand-green-ink shadow-sm transition hover:border-brand-green hover:text-brand-green"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function FlowStep({
  href,
  label,
  value,
  detail,
  tone = "default",
}: {
  href: string;
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      className={`grid min-h-[120px] rounded-lg border p-4 shadow-sm transition hover:border-brand-green hover:shadow-md ${toneClass(tone)}`}
    >
      <p className="admin-wide-label text-xs font-black uppercase opacity-65">{label}</p>
      <p className="admin-wide-value mt-2 text-xl font-black">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 opacity-75">{detail}</p>
    </Link>
  );
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function readPath<T>(source: unknown, path: string, defaultVal: T): T {
  let value: unknown = source;

  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !(key in value)) {
      return defaultVal;
    }

    value = (value as Record<string, unknown>)[key];
  }

  return (value ?? defaultVal) as T;
}

// Safe data fetching with fallbacks
async function safeGetData() {
  const session = await getAdminSession();

  // Fetch all data with error handling
  const [
    productsResult,
    ordersResult,
    messagesResult,
    operationsResult,
    paymentReconciliationResult,
    posResult,
    purchasingResult,
    costingResult,
    hrResult,
    productionControlResult,
  ] = await Promise.allSettled([
    getProducts({ includeDrafts: true }),
    getOrders(),
    getContactMessages(),
    getOperationsSnapshot(),
    getPaymentReconciliation(),
    getPosSnapshot(),
    getPurchasingSnapshot(),
    getCostingSnapshot(),
    getHrSnapshot(),
    getProductionControlSummary(),
  ]);

  const alertCenter = (await getOperationalAlertCenter().catch(() => null)) ?? null;
  const readiness = (await getProductionReadinessWithData().catch(() => [])) ?? [];

  return {
    session,
    products: settledValue(productsResult, [] as Product[]).filter((product) => product && "priceValue" in product),
    orders: settledValue(ordersResult, [] as OrderSubmission[]).filter((order) => order && "id" in order && "total" in order),
    messages: settledValue(messagesResult, [] as ContactSubmission[]).filter((message) => message && "id" in message),
    operations: settledValue(operationsResult, {} as OperationsSnapshot),
    paymentReconciliation: settledValue(paymentReconciliationResult, {} as PaymentReconciliationSnapshot),
    pos: settledValue(posResult, {} as PosSnapshot),
    purchasing: settledValue(purchasingResult, {} as PurchasingSnapshot),
    costing: settledValue(costingResult, {} as CostingSnapshot),
    hr: settledValue(hrResult, {} as HrSnapshot),
    productionControl: settledValue(productionControlResult, emptyProductionControlSummary()),
    alertCenter: (alertCenter ?? { summary: {}, alerts: [] }) as OperationalAlertCenter,
    readiness,
  };
}

export default async function AdminDashboardPage() {
  await requireAdminPermission("dashboard:read");
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
    productionControl,
    alertCenter,
    readiness,
  } = await safeGetData();

  // Safe access to data with defaults
  const getOp = <T,>(path: string, defaultVal: T) => readPath(operations, path, defaultVal);
  const getPos = <T,>(path: string, defaultVal: T) => readPath(pos, path, defaultVal);
  const getPur = <T,>(path: string, defaultVal: T) => readPath(purchasing, path, defaultVal);
  const getCost = <T,>(path: string, defaultVal: T) => readPath(costing, path, defaultVal);
  const getHr = <T,>(path: string, defaultVal: T) => readPath(hr, path, defaultVal);
  const getAlert = <T,>(path: string, defaultVal: T) => readPath(alertCenter, path, defaultVal);

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

  const topEarners = getCost("designCosting", [] as DesignCostingRow[])
    .filter((row) => row.soldPairs > 0 && row.grossProfit > 0)
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 5);

  const pendingReviews = products.flatMap((product) => product.reviews || []).filter((review) => review?.status === "pending");
  const catalogStockValue = products.reduce((total, product) => total + (product?.priceValue || 0) * (product?.stock || 0), 0);

  const orderTotal = orders.reduce((total, order) => total + amountFromOrderTotal(order?.total || "0"), 0);
  const newOrders = orders.filter((order) => order?.status === "New");
  const pendingPayments = orders.filter((order) => order?.paymentStatus === "Pending");
  const unpaidOrders = orders.filter((order) => order?.paymentStatus === "Unpaid");

  const openMessages = messages.filter((message) => message?.status === "New");

  const productionCompletion = percentage(getOp("summary.finishedPairs", 0), getOp("summary.plannedPairs", 1));

  const paymentIssueTone: Tone =
    paymentReconciliation?.summary?.highRiskIssueCount > 0
      ? "danger"
      : paymentReconciliation?.summary?.issueCount > 0
        ? "warn"
        : "good";

  const launchStatus =
    readinessSummary.launchReady ? "ready" : readinessSummary.blocked > 0 ? "blocked" : "warning";

  const collectionQueue = getOp("reports.ledgerCollectionFollowups", [] as CollectionFollowup[]).filter(
    (ledger) => ledger.priority !== "Clear",
  );
  const rawMaterials = getOp("rawMaterials", [] as RawMaterialRow[]);
  const lowRawMaterials = rawMaterials.filter(
    (material) => material.lowStock || material.balance <= material.reorderLevel,
  );
  const materialConsumptions = getOp("materialConsumptions", [] as MaterialConsumptionRow[]);
  const todayIsoKey = new Date().toISOString().slice(0, 10);
  const todayMaterialIssues = materialConsumptions.filter(
    (consumption) => consumption.createdAt.slice(0, 10) === todayIsoKey,
  );
  const todayMaterialIssueQuantity = todayMaterialIssues.reduce(
    (total, consumption) => total + consumption.quantity + consumption.wastage,
    0,
  );
  const workerTasks = getOp("workerTasks", [] as WorkerTaskRow[]);
  const activeWorkerTasks = workerTasks.filter((task) => task.status !== "Done");
  const doneWorkerTaskPairs = workerTasks.reduce((total, task) => total + task.completedPairs, 0);
  const productionBatches = getOp("productionBatches", [] as ProductionBatchRow[]);
  const activeProductionBatches = productionBatches.filter((batch) => batch.status !== "Packed");
  const supplierPaymentQueue = getPur("reports.supplierPaymentFollowups", [] as SupplierPaymentFollowup[]).filter(
    (supplier) => supplier.priority !== "Clear",
  );
  const payrollSuggestions = getHr("reports.payrollSuggestions", [] as PayrollSuggestionRow[]);
  const payrollActionCount = payrollSuggestions.filter((suggestion) => suggestion.statusSignal !== "Recorded").length;
  const todayCollected =
    getPos("todayDayClose.cashAmount", 0) +
    getPos("todayDayClose.chequeAmount", 0) +
    getPos("todayDayClose.qrAmount", 0) +
    getPos("todayDayClose.eSewaAmount", 0) +
    getPos("todayDayClose.khaltiAmount", 0) +
    getPos("todayDayClose.bankAmount", 0);
  const todayBillCount = getPos("todayDayClose.invoiceCount", 0);
  const accountingReviewCount =
    getPur("summary.postingNeedsReview", 0) +
    getPos("summary.needsReview", 0) +
    (paymentReconciliation?.summary?.issueCount || 0);
  const dailyActions = [
    {
      href: "/admin/orders",
      label: "Online Orders",
      value: newOrders.length,
      detail: `${pendingPayments.length + unpaidOrders.length} payment follow-up`,
      Icon: ShoppingCartIcon,
      tone: newOrders.length > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/pos",
      label: "Sales Billing",
      value: money(getPos("summary.todayNetSales", 0)),
      detail: `${todayBillCount} bills today`,
      Icon: CreditCardIcon,
      tone: getPos("summary.needsReview", 0) > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/purchasing",
      label: "Purchase Receive",
      value: money(getPur("summary.todayPurchase", 0)),
      detail: `${getPur("summary.postingNeedsReview", 0)} bills need review`,
      Icon: PackageIcon,
      tone: getPur("summary.postingNeedsReview", 0) > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations",
      label: "Material Issue",
      value: todayMaterialIssues.length,
      detail: `${lowRawMaterials.length} low material, ${todayMaterialIssueQuantity} used today`,
      Icon: PackageIcon,
      tone: lowRawMaterials.length > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations/production-accounts",
      label: "Worker Work",
      value: `${productionControl.todayGoodPairs} pairs`,
      detail: `${activeWorkerTasks.length} active tasks, ${money(productionControl.workerBalanceDue)} due`,
      Icon: UserIcon,
      tone: productionControl.workerBalanceDue > 0 || productionControl.handoverMismatches > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations/production-accounts",
      label: "QC Stock In",
      value: productionControl.readyForQc,
      detail: `${productionControl.todayStockPairs} pairs stocked today`,
      Icon: ShieldCheckIcon,
      tone: productionControl.readyForQc > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/dues",
      label: "Receive Payment",
      value: collectionQueue.length + supplierPaymentQueue.length,
      detail: `${money(todayCollected)} collected today`,
      Icon: CreditCardIcon,
      tone: collectionQueue.length > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/customers",
      label: "Customer Care",
      value: openMessages.length,
      detail: "messages and account trust",
      Icon: MessageSquareIcon,
      tone: openMessages.length > 0 ? ("warn" as const) : ("good" as const),
    },
  ];
  const quickCommands = [
    { href: "/admin/purchasing", label: "Receive material", Icon: PackageIcon },
    { href: "/admin/operations", label: "Issue material", Icon: PackageIcon },
    { href: "/admin/operations/production-accounts", label: "Worker work", Icon: UserIcon },
    { href: "/admin/operations/production-accounts", label: "QC stock in", Icon: ShieldCheckIcon },
    { href: "/admin/pos", label: "Sales bill", Icon: CreditCardIcon },
    { href: "/admin/dues", label: "Receive payment", Icon: CreditCardIcon },
    { href: "/admin/search", label: "Search", Icon: SearchIcon },
  ];
  const operatingFlow = [
    {
      href: "/admin/purchasing",
      label: "1. Purchase Receive",
      value: money(getPur("summary.todayPurchase", 0)),
      detail: `${supplierPaymentQueue.length} supplier follow-up`,
      tone: supplierPaymentQueue.length > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations",
      label: "2. Material Issue",
      value: todayMaterialIssues.length,
      detail: `${lowRawMaterials.length} materials near reorder`,
      tone: lowRawMaterials.length > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations/production-accounts",
      label: "3. Worker Output",
      value: `${productionControl.todayGoodPairs} good`,
      detail: `${doneWorkerTaskPairs} total completed, ${productionControl.todayRejectedPairs} rejected today`,
      tone: productionControl.todayRejectedPairs > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/operations/production-accounts",
      label: "4. QC And Stock",
      value: productionControl.readyForQc,
      detail: `${productionControl.activeWorkOrders} active work orders`,
      tone: productionControl.readyForQc > 0 || productionControl.overdueWorkOrders > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/pos",
      label: "5. Sales And POS",
      value: money(getPos("summary.todayNetSales", 0)),
      detail: `${todayBillCount} bills, ${getPos("summary.needsReview", 0)} review`,
      tone: getPos("summary.needsReview", 0) > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      href: "/admin/payments",
      label: "6. Payment Close",
      value: money(todayCollected),
      detail: `${accountingReviewCount} accounting review`,
      tone: accountingReviewCount > 0 ? ("warn" as const) : ("good" as const),
    },
  ];

  return (
    <section className="p-6">
      <section className="rounded-lg border border-brand-green/15 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
          <div>
            <p className="admin-wide-label text-xs font-black uppercase text-brand-gold-ink">
              Owner control room
            </p>
            <h1 className="admin-wide-title mt-2 text-3xl font-black leading-tight text-brand-green-ink md:text-4xl">
              KRISHOE Daily Control
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Today operating numbers from factory, purchasing, sales, ledger, payment, and customer queues.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 xl:justify-end">
            <StatusBadge
              label={launchStatus === "ready" ? "Ready" : launchStatus}
              tone={launchStatus === "ready" ? "good" : launchStatus === "blocked" ? "danger" : "warn"}
            />
            <StatusBadge label={backendStatus.backend} tone={backendStatus.databaseUrlConfigured ? "good" : "warn"} />
            <StatusBadge label={adminAccess.role} tone={adminAccess.role === "Owner" ? "good" : "warn"} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {quickCommands.map((command) => (
            <QuickCommand key={command.label} {...command} />
          ))}
          <Link
            href="/api/admin/backup"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-green px-3 text-sm font-black text-white shadow-sm transition hover:bg-brand-green-ink"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Export backup
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            {
              label: "Today sales",
              value: money(getPos("summary.todayNetSales", 0)),
              detail: `${todayBillCount} bills`,
              href: "/admin/pos",
              tone: "good" as Tone,
            },
            {
              label: "Today purchase",
              value: money(getPur("summary.todayPurchase", 0)),
              detail: `${getPur("summary.purchaseInvoiceCount", 0)} purchase bills`,
              href: "/admin/purchasing",
              tone: "default" as Tone,
            },
            {
              label: "Collected",
              value: money(todayCollected),
              detail: "cash, cheque, QR, wallet, bank",
              href: "/admin/payments",
              tone: todayCollected > 0 ? ("good" as Tone) : ("default" as Tone),
            },
            {
              label: "Production live",
              value: activeProductionBatches.length,
              detail: `${productionControl.activeWorkOrders} work orders`,
              href: "/admin/operations/production-accounts",
              tone: productionControl.overdueWorkOrders > 0 ? ("warn" as Tone) : ("good" as Tone),
            },
            {
              label: "Worker pay action",
              value: payrollActionCount,
              detail: `${money(productionControl.workerBalanceDue)} balance`,
              href: "/admin/hr",
              tone: payrollActionCount > 0 || productionControl.workerBalanceDue > 0 ? ("warn" as Tone) : ("good" as Tone),
            },
            {
              label: "Supplier due",
              value: money(getPur("summary.supplierDue", 0)),
              href: "/admin/dues",
              detail: `${supplierPaymentQueue.length} follow-up`,
              tone: getPur("summary.supplierDue", 0) > 0 ? ("warn" as Tone) : ("good" as Tone),
            },
          ].map((cell) => {
            const body = (
              <>
                <p className="admin-wide-label text-xs font-black uppercase text-brand-muted">{cell.label}</p>
                <p className="admin-wide-value mt-2 text-xl font-black text-brand-green-ink">{cell.value}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">{cell.detail}</p>
              </>
            );

            return (
              <Link
                key={cell.label}
                href={cell.href}
                className={`rounded-lg border p-4 transition hover:border-brand-green/40 hover:shadow-sm ${toneClass(cell.tone)}`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="admin-wide-title text-xl font-black text-brand-green-ink">Today action board</h2>
            <p className="mt-1 text-sm text-gray-500">
              Live work areas from orders, material, production, collection, and customer care.
            </p>
          </div>
          <Link href="/admin/activity" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Activity log
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dailyActions.map((action) => (
            <ControlTile key={`${action.href}-${action.label}`} {...action} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="admin-wide-title text-xl font-black text-brand-green-ink">Business operating flow</h2>
            <p className="mt-1 text-sm text-gray-500">
              Purchase, material, worker output, QC stock, sales, and payment close status.
            </p>
          </div>
          <Link href="/api/admin/readiness" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Readiness JSON
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {operatingFlow.map((step) => (
            <FlowStep key={step.label} {...step} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-brand-gold-bright/40 bg-brand-cream-soft/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="admin-wide-title text-lg font-black text-brand-green-ink">Profit at a glance</h2>
          <Link href="/admin/costing" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Costing detail
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {getCost("periodReports", [] as CostingPeriodRow[]).map((period) => (
            <div key={period?.label} className="rounded-lg border border-brand-green/10 bg-white p-4">
              <p className="admin-wide-label text-xs font-semibold uppercase text-brand-muted">{period?.label}</p>
              <p
                className={`admin-wide-value mt-1 text-xl font-black ${
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
            <p className="admin-wide-label text-xs font-black uppercase text-brand-muted">Top earning designs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topEarners.map((row) => (
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
            {getAlert("alerts", [] as OperationalAlert[]).slice(0, 5).map((alert) => (
              <Link key={alert?.id} href={alert?.href || "#"} className="block py-3 transition hover:text-brand-green">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-brand-green-ink">{alert?.title || "Alert"}</p>
                  <StatusBadge label={alert?.severity || "info"} tone={alertTone(alert?.severity || "info")} />
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{alert?.detail || ""}</p>
              </Link>
            ))}
            {getAlert("alerts", [] as OperationalAlert[]).length === 0 ? (
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
            {getOp("reports.productionInsights", [] as ProductionInsight[]).slice(0, 3).map((batch) => (
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
              <p className="admin-wide-label text-xs font-black uppercase text-brand-green">Fast moving</p>
              {getOp("fastMovingStock", [] as FastMovingStock[]).slice(0, 3).map((stock) => (
                <p key={stock?.id} className="mt-2 text-sm text-gray-700">
                  {stock?.design}: <span className="font-bold">{stock?.soldPairs}</span> sold
                </p>
              ))}
            </div>
            <div>
              <p className="admin-wide-label text-xs font-black uppercase text-brand-clay">Low catalog stock</p>
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
            {collectionQueue.slice(0, 4).map((ledger) => (
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
            <CommandLine value='DATABASE_URL="postgres://..." npm run db:import -- ./krishoe-backup-v15.json --replace --confirm-replace --confirm-database=VERIFY_DATABASE_NAME' />
            <CommandLine value='DATABASE_URL="postgres://..." npm run db:smoke -- ./krishoe-backup-v15.json' />
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
