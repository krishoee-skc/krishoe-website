import Link from "next/link";
import type { ComponentType } from "react";
import AlertText from "@/components/admin/AlertText";
import {
  CreditCardIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "@/components/Icons";
import { getAdminSession } from "@/lib/admin-auth";
import { canAdmin, getAdminPermissionSummary, getSessionAdminRole, requireAdminPermission } from "@/lib/admin-permissions";
import { getPosSnapshot } from "@/lib/pos";
import { getProductionControlSummary } from "@/lib/production-accounting";
import { getProducts } from "@/lib/product-store";
import type { Product } from "@/lib/products";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import { isLowOrOut } from "@/lib/stock-thresholds";
import { getOrders, type OrderSubmission } from "@/lib/submissions";
import TodayBoard from "@/app/admin/TodayBoard";
import TodaySales from "@/components/admin/TodaySales";
import StaffToday from "@/components/admin/StaffToday";
import GoalCard from "@/components/admin/GoalCard";
import ChannelCompare from "@/components/admin/ChannelCompare";
import { getBusinessGoal, currentGoalMonthKey } from "@/lib/business-goals";

export const dynamic = "force-dynamic";

type IconComponent = ComponentType<{ className?: string }>;

// The brand's colours as gradients, so a medallion carries the shop's green and
// gold rather than a flat fill. Kept here as data so every tile below draws
// from the same six and the screen reads as one family.
const GRAD = {
  emerald: "linear-gradient(150deg,#12876a,#0B4D3B)",
  gold: "linear-gradient(150deg,#E9C978,#C8A04D)",
  teal: "linear-gradient(150deg,#159a83,#0E7D6B)",
  clay: "linear-gradient(150deg,#c86a5b,#A9503F)",
  plum: "linear-gradient(150deg,#8a68a6,#6E4B86)",
  deep: "linear-gradient(150deg,#3f6f5e,#2c5244)",
} as const;

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString("en-IN")}`;
}

function readPath<T>(source: unknown, path: string, defaultVal: T): T {
  let value: unknown = source;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !(key in value)) return defaultVal;
    value = (value as Record<string, unknown>)[key];
  }
  return (value ?? defaultVal) as T;
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === "fulfilled" ? result.value : fallback;
}

// One big, thumb-sized button per common job. The label is Nepali with the
// English underneath, and the mark is the shop's own icon in a coloured
// medallion — the same icon on every phone, in the brand's colour, where an
// emoji would have been whatever font the device happened to carry.
function QuickTile({
  href,
  labelEn,
  labelNe,
  Icon,
  gradient,
}: {
  href: string;
  labelEn: string;
  labelNe: string;
  Icon: IconComponent;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-3xl border border-brand-green-line bg-brand-paper p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md"
    >
      <span
        className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-sm"
        style={{ background: gradient }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="font-display text-[15px] font-bold leading-tight text-brand-green-ink">
        <AlertText en={labelEn} ne={labelNe} />
      </span>
    </Link>
  );
}

function HealthTile({
  href,
  labelEn,
  labelNe,
  value,
  Icon,
  gradient,
  positive = false,
}: {
  href: string;
  labelEn: string;
  labelNe: string;
  value: string;
  Icon: IconComponent;
  gradient: string;
  positive?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-brand-green-line bg-brand-paper p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-xl text-white shadow-sm"
          style={{ background: gradient }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-brand-muted">
          <AlertText en={labelEn} ne={labelNe} />
        </span>
      </div>
      <p
        className={`mt-3 font-display text-2xl font-black leading-none tabular-nums ${positive ? "text-emerald-700" : "text-brand-green-ink"}`}
      >
        {value}
      </p>
      <span className="mt-3 block h-1.5 rounded-full" style={{ background: gradient }} />
    </Link>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminPermission("dashboard:read");

  const session = await getAdminSession();
  const [posResult, purchasingResult, productsResult, ordersResult, productionResult] =
    await Promise.allSettled([
      getPosSnapshot(),
      getPurchasingSnapshot(),
      getProducts({ includeDrafts: true }),
      getOrders(),
      getProductionControlSummary(),
    ]);

  const pos = settled(posResult, {} as unknown);
  const purchasing = settled(purchasingResult, {} as unknown);
  const products = settled(productsResult, [] as Product[]).filter(
    (product) => product && "priceValue" in product,
  );
  const orders = settled(ordersResult, [] as OrderSubmission[]).filter(
    (order) => order && "id" in order,
  );
  const productionControl = settled(productionResult, {} as unknown);

  const adminAccess = getAdminPermissionSummary(getSessionAdminRole(session));
  const isOwner = canAdmin(adminAccess.role, "settings:write");

  const getPos = <T,>(path: string, fallback: T): T => readPath(pos, path, fallback);

  const todayNetSales = getPos("summary.todayNetSales", 0);
  const todayPairsSold = getPos("summary.todayPairs", 0);
  const billCount = getPos("todayDayClose.invoiceCount", 0);
  const todayCollected =
    getPos("todayDayClose.cashAmount", 0) +
    getPos("todayDayClose.chequeAmount", 0) +
    getPos("todayDayClose.qrAmount", 0) +
    getPos("todayDayClose.eSewaAmount", 0) +
    getPos("todayDayClose.khaltiAmount", 0) +
    getPos("todayDayClose.bankAmount", 0);
  const creditToday = Math.max(0, todayNetSales - todayCollected);
  const creditOwed = getPos("summary.totalCredit", 0);

  const newOrders = orders.filter((order) => order?.status === "New");
  const lowStockProducts = products.filter((product) => isLowOrOut(product.stock));
  const catalogStockValue = products.reduce(
    (total, product) => total + (product?.priceValue || 0) * (product?.stock || 0),
    0,
  );

  const todayGoodPairs = readPath(productionControl, "todayGoodPairs", 0);
  const workerBalanceDue = readPath(productionControl, "workerBalanceDue", 0);
  const monthProfit = readPath(purchasing, "summary.monthProfitEstimate", 0);
  const monthSales = getPos("summary.monthNetSales", 0);
  // Today's sales split by channel, from the POS day-close snapshot. Read
  // defensively — an empty array is a fine "no sales yet" state.
  const channelRows = getPos<
    Array<{ channel: "Retail" | "Wholesale" | "Online"; invoiceCount: number; netTotal: number }>
  >("todayDayClose.channelRows", []);

  // This month's goal, for the owner's dashboard. A failure to read it must not
  // take down the whole dashboard — the goal card simply doesn't show.
  const goalMonthKey = currentGoalMonthKey();
  const businessGoal = await getBusinessGoal(goalMonthKey).catch(() => null);

  const quickTiles = [
    { href: "/admin/pos", labelEn: "Billing", labelNe: "बिल काट्ने", Icon: CreditCardIcon, gradient: GRAD.emerald },
    { href: "/admin/purchasing", labelEn: "Purchase", labelNe: "किनमेल", Icon: PackageIcon, gradient: GRAD.gold },
    { href: "/admin/factory/add-work", labelEn: "Add work", labelNe: "काम टिप्ने", Icon: PlusIcon, gradient: GRAD.teal },
    { href: "/admin/orders", labelEn: "Orders", labelNe: "अर्डर", Icon: ShoppingCartIcon, gradient: GRAD.clay },
    { href: "/admin/dues", labelEn: "Credit", labelNe: "उधारो", Icon: CreditCardIcon, gradient: GRAD.plum },
    { href: "/admin/search", labelEn: "Search", labelNe: "खोज्ने", Icon: SearchIcon, gradient: GRAD.deep },
  ];

  // Built as a list so each Nepali label sits behind a `labelNe:` the pairing
  // check recognises, rather than a JSX attribute it would count as unpaired.
  const healthTiles = [
    { href: "/admin/costing", labelEn: "This month's profit", labelNe: "महिनाको नाफा", value: money(monthProfit), Icon: CreditCardIcon, gradient: GRAD.emerald, positive: true },
    { href: "/admin/products", labelEn: "Stock value", labelNe: "स्टक मूल्य", value: money(catalogStockValue), Icon: PackageIcon, gradient: GRAD.gold, positive: false },
    { href: "/admin/dues", labelEn: "Credit owed to shop", labelNe: "बाँकी उधारो", value: money(creditOwed), Icon: CreditCardIcon, gradient: GRAD.clay, positive: false },
  ];

  return (
    <section className="p-6 space-y-6">
      {/* The hero the owner opens the app to see — today's money, one number
          larger than anything else — or, for a salesperson, their own counter.
          The menu beside this is already filtered by role; this makes the page
          match, so nobody meets a room of numbers they cannot act on. */}
      {isOwner ? (
        <TodaySales
          netSales={todayNetSales}
          collected={todayCollected}
          billCount={billCount}
          pairsSold={todayPairsSold}
        />
      ) : (
        <StaffToday
          name={session?.name ?? ""}
          role={adminAccess.role}
          billsToday={billCount}
          soldToday={todayNetSales}
          creditToday={creditToday}
          ordersToSend={newOrders.length}
        />
      )}

      {/* This month's goal and how close the shop is — owner only, and only
          when the goal read succeeded. Sits under today's money so the day
          reads against a target. */}
      {isOwner && businessGoal ? (
        <GoalCard
          goal={businessGoal}
          monthSales={monthSales}
          monthProfit={monthProfit}
          monthPairs={todayGoodPairs}
        />
      ) : null}

      {/* Which channel is carrying today — owner only. Shown after the goal so
          the owner reads the target, then where the money is coming from. */}
      {isOwner && channelRows.length > 0 ? <ChannelCompare rows={channelRows} /> : null}

      {/* What needs doing, before any reporting. */}
      <TodayBoard
        todayPairs={todayGoodPairs}
        newOrders={newOrders.length}
        lowStockNames={lowStockProducts.map((product) => product.name)}
        workerDue={workerBalanceDue}
      />

      {/* छिटो काम — the six jobs done most often, one tap each. */}
      <section>
        <h2 className="mb-3 font-display text-xl font-black text-brand-green-ink">
          <AlertText en="Quick jobs" ne="छिटो काम" />
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {quickTiles.map((tile) => (
            <QuickTile key={tile.href + tile.labelEn} {...tile} />
          ))}
        </div>
      </section>

      {/* पसल कस्तो छ — the shop's health at a glance, for the owner. Everything
          deeper lives on its own screen, reached from the menu or a tile. */}
      {isOwner ? (
        <section data-zone="health">
          <h2 className="mb-3 font-display text-xl font-black text-brand-green-ink">
            <AlertText en="How the shop is doing" ne="पसल कस्तो छ" />
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {healthTiles.map((tile) => (
              <HealthTile key={tile.href + tile.labelEn} {...tile} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
