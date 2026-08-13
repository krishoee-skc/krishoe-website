import Link from "next/link";
import { ArrowRightIcon, PackageIcon, UserIcon, BellIcon } from "@/components/Icons";
import type { ReactNode } from "react";

interface QuickCardProps {
  title: string;
  titleNepali: string;
  value: string | number;
  detail: string;
  detailNepali: string;
  action: string;
  href: string;
  tone?: "default" | "good" | "warn" | "danger";
  icon?: ReactNode;
}

function QuickCard({
  title,
  titleNepali,
  value,
  detail,
  detailNepali,
  action,
  href,
  tone = "default",
  icon,
}: QuickCardProps) {
  const toneClasses = {
    good: "border-emerald-200 bg-emerald-50 hover:border-emerald-300",
    warn: "border-amber-200 bg-amber-50 hover:border-amber-300",
    danger: "border-red-200 bg-red-50 hover:border-red-300",
    default: "border-gray-200 bg-white hover:border-gray-300",
  };

  const valueColor = {
    good: "text-emerald-700",
    warn: "text-amber-700",
    danger: "text-red-700",
    default: "text-brand-green-ink",
  };

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-xl border p-6 shadow-sm transition ${toneClasses[tone]}`}
    >
      {/* Background accent */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-xl" />

      <div className="relative">
        {/* Header with icon and arrow */}
        <div className="mb-4 flex items-start justify-between">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/50 shadow-sm">
            {icon || <PackageIcon className="h-6 w-6" />}
          </div>
          <ArrowRightIcon className="h-5 w-5 opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100" />
        </div>

        {/* Labels */}
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{title}</p>
          <p className="text-xs font-semibold text-gray-500">{titleNepali}</p>
        </div>

        {/* Main value */}
        <p className={`text-3xl font-black leading-none ${valueColor[tone]} mb-3`}>{value}</p>

        {/* Details */}
        <p className="mb-2 text-xs font-medium text-gray-600">{detail}</p>
        <p className="text-xs font-medium text-gray-500">{detailNepali}</p>

        {/* Action label */}
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-1 text-xs font-bold text-brand-green-ink shadow-sm">
          {action}
          <ArrowRightIcon className="h-3 w-3" />
        </p>
      </div>
    </Link>
  );
}

interface AdminQuickHomeProps {
  todayProduction: {
    pairs: number;
    amount: number;
    activeWorkers: number;
  };
  pendingPayments: {
    count: number;
    totalAmount: number;
  };
  newOrders: {
    count: number;
    totalAmount: number;
  };
  lowStockProducts: {
    count: number;
    names: string[];
  };
  topWorker: {
    name: string;
    pairs: number;
    amount: number;
  };
}

export default function QuickAdminHome({
  todayProduction,
  pendingPayments,
  newOrders,
  lowStockProducts,
  topWorker,
}: AdminQuickHomeProps) {
  const formatMoney = (value: number) => `Rs. ${value.toLocaleString("en-IN")}`;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-brand-green/20 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold-ink">तुरुन्त अवलोकन</p>
        <h1 className="mt-2 text-2xl font-black text-brand-green-ink md:text-3xl">KRISHOE आज को नियन्त्रण कक्ष</h1>
        <p className="mt-2 text-sm text-gray-600">कारखाना, बिक्रय र बुकिङ - सबै एक नजरमा</p>
      </div>

      {/* Main Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {/* Card 1: Today's Production */}
        <QuickCard
          title="Today Production"
          titleNepali="आज को उत्पादन"
          value={`${todayProduction.pairs} जोडी`}
          detail={`Total: ${formatMoney(todayProduction.amount)}`}
          detailNepali={`${todayProduction.activeWorkers}/12 workers active`}
          action="Production"
          href="/admin/operations/production-accounts"
          tone={todayProduction.pairs > 200 ? "good" : "default"}
          icon={<PackageIcon className="h-6 w-6" />}
        />

        {/* Card 2: Pending Payments */}
        <QuickCard
          title="Pending Payments"
          titleNepali="भुक्तानी गर्ने बाकी"
          value={pendingPayments.count}
          detail={`Workers owe: ${formatMoney(pendingPayments.totalAmount)}`}
          detailNepali={`काम दिएको तर पैसा नदिएको`}
          action="Pay Now"
          href="/admin/factory/ledger"
          tone={pendingPayments.count > 0 ? "warn" : "good"}
          icon={<BellIcon className="h-6 w-6" />}
        />

        {/* Card 3: New Orders */}
        <QuickCard
          title="New Orders"
          titleNepali="नयाँ অর्डर"
          value={newOrders.count}
          detail={`Revenue: ${formatMoney(newOrders.totalAmount)}`}
          detailNepali={`नयाँ customers को अर्डर`}
          action="Process"
          href="/admin/orders"
          tone={newOrders.count > 0 ? "warn" : "good"}
          icon={<UserIcon className="h-6 w-6" />}
        />

        {/* Card 4: Low Stock */}
        <QuickCard
          title="Low Stock"
          titleNepali="कम स्टक"
          value={lowStockProducts.count}
          detail={lowStockProducts.names.join(", ") || "Good stock level"}
          detailNepali="खरिद गर्न सक्छ"
          action="Check Stock"
          href="/admin/stock"
          tone={lowStockProducts.count > 0 ? "danger" : "good"}
          icon={<BellIcon className="h-6 w-6" />}
        />

        {/* Card 5: Top Worker */}
        <QuickCard
          title="Top Performer"
          titleNepali="सितारा कामदार"
          value={`${topWorker.pairs} जोडी`}
          detail={`${topWorker.name}: ${formatMoney(topWorker.amount)}`}
          detailNepali="आज को सबै भन्दा राम्रो काम"
          action="View"
          href="/admin/factory/ledger"
          tone="good"
          icon={<UserIcon className="h-6 w-6" />}
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="w-full text-xs font-black uppercase text-gray-500">तुरुन्त काम</p>
        <Link
          href="/admin/factory/add-work"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 font-bold text-white shadow-sm transition hover:bg-brand-green-ink"
        >
          + काम भर्ने
        </Link>
        <Link
          href="/admin/factory/ledger"
          className="inline-flex items-center gap-2 rounded-lg border border-brand-green/30 bg-white px-4 py-2 font-bold text-brand-green-ink shadow-sm transition hover:border-brand-green"
        >
          💰 भुक्तानी
        </Link>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 rounded-lg border border-brand-green/30 bg-white px-4 py-2 font-bold text-brand-green-ink shadow-sm transition hover:border-brand-green"
        >
          📦 Orders
        </Link>
        <Link
          href="/admin/pos"
          className="inline-flex items-center gap-2 rounded-lg border border-brand-green/30 bg-white px-4 py-2 font-bold text-brand-green-ink shadow-sm transition hover:border-brand-green"
        >
          🛒 POS Bill
        </Link>
      </div>
    </section>
  );
}
