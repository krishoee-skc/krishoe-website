import Link from "next/link";
import type { ComponentType } from "react";
import AlertText from "@/components/admin/AlertText";
import {
  CreditCardIcon,
  PackageIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "@/components/Icons";
import { money } from "@/lib/format-money";
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
import StaffToday from "@/components/admin/StaffToday";
import OwnerDashboard, { type Todo } from "@/components/admin/OwnerDashboard";
import { getBusinessGoal, currentGoalMonthKey } from "@/lib/business-goals";
import { getStockByPlace } from "@/lib/stock-transfers";
import {
  bikramMonthLabel,
  toBikramSambatNepali,
  toBikramSambatRoman,
} from "@/lib/bikram-sambat";
import {
  bsMonthSoFar,
  nepalDayKey,
  netSalesBetween,
  salesByDay,
  stockAtSellingPrice,
  type SaleLike,
} from "@/lib/dashboard-figures";

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

export default async function AdminDashboardPage() {
  await requireAdminPermission("dashboard:read");

  const session = await getAdminSession();
  const [posResult, purchasingResult, productsResult, ordersResult, productionResult, placesResult] =
    await Promise.allSettled([
      getPosSnapshot(),
      getPurchasingSnapshot(),
      getProducts({ includeDrafts: true }),
      getOrders(),
      getProductionControlSummary(),
      getStockByPlace(),
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

  // What the factory made today is what went into stock — "Post to stock" and
  // Packing/QC both land there. The work entries are per stage: one pair
  // passing Upper and Fibermen is two entries, and adding them up read sixty
  // pairs as a hundred and twenty (owner, 2026-09-29). So they are shown side
  // by side and never summed.
  const todayStockPairs = readPath(productionControl, "todayStockPairs", 0);
  const todayStagePairs = readPath<Array<{ stage: string; pairs: number }>>(productionControl, "todayStagePairs", [])
    .filter((entry) => entry.pairs > 0);
  const todayStageLine = todayStagePairs.map((entry) => `${entry.stage} ${entry.pairs}`).join(" · ");
  const workerBalanceDue = readPath(productionControl, "workerBalanceDue", 0);
  const monthProfit = readPath(purchasing, "summary.monthProfitEstimate", 0);
  const monthSales = getPos("summary.monthNetSales", 0);
  // Today's sales split by channel, from the POS day-close snapshot. Read
  // defensively — an empty array is a fine "no sales yet" state.
  const channelRows = getPos<
    Array<{ channel: "Retail" | "Wholesale" | "Online"; invoiceCount: number; netTotal: number }>
  >("todayDayClose.channelRows", []);

  // This month's goal, for the owner's dashboard. A failure to read it must not
  // take down the whole dashboard — the ring simply asks for a goal.
  const goalMonthKey = currentGoalMonthKey();
  const businessGoal = isOwner ? await getBusinessGoal(goalMonthKey).catch(() => null) : null;

  // Cutting a bill and adding work are the big buttons under "Today's work"
  // just above; drawn here as well, the same two jobs appeared twice on one
  // screen.
  const quickTiles = [
    { href: "/admin/purchasing", labelEn: "Purchase", labelNe: "किनमेल", Icon: PackageIcon, gradient: GRAD.gold },
    { href: "/admin/orders", labelEn: "Orders", labelNe: "अर्डर", Icon: ShoppingCartIcon, gradient: GRAD.clay },
    { href: "/admin/dues", labelEn: "Credit", labelNe: "उधारो", Icon: CreditCardIcon, gradient: GRAD.plum },
    { href: "/admin/search", labelEn: "Search", labelNe: "खोज्ने", Icon: SearchIcon, gradient: GRAD.deep },
  ];


  if (isOwner) {
    // ── The owner's dashboard: the owner's sample, 2026-09-28 ──────────
    const now = new Date();
    const invoices = getPos<SaleLike[]>("invoices", []);
    const days = salesByDay(invoices, 7, now);
    const todayKey = nepalDayKey(now);
    const weekStart = days[0]?.key ?? todayKey;
    const weekNet = netSalesBetween(invoices, weekStart, addOneDay(todayKey));
    const bsMonth = bsMonthSoFar(now);
    const monthNet = bsMonth ? netSalesBetween(invoices, bsMonth.startKey, bsMonth.endKey) : monthSales;
    // Sales less purchases in the same Bikram Sambat month — not profit: what
    // was bought is still on the shelf.
    const purchaseInvoices = readPath<Array<{ createdAt: string; total: number }>>(purchasing, "purchaseInvoices", []);
    const monthPurchases = bsMonth
      ? purchaseInvoices
          .filter((invoice) => {
            const key = nepalDayKey(invoice.createdAt);
            return key >= bsMonth.startKey && key < bsMonth.endKey;
          })
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0)
      : 0;
    const salesLessPurchases = bsMonth ? monthNet - monthPurchases : monthProfit;

    const active = products.filter((product) => product.status === "Active");
    const soldOut = active.filter((product) => (product.stock || 0) <= 0);
    const runningLow = active.filter((product) => isLowOrOut(product.stock) && (product.stock || 0) > 0);
    const places = settled(placesResult, [] as Awaited<ReturnType<typeof getStockByPlace>>);
    const mismatched = places.filter((row) => row.unplaced !== 0).length;
    const channel = (name: "Retail" | "Wholesale" | "Online") =>
      channelRows.find((row) => row.channel === name)?.netTotal ?? 0;

    const monthNe = bikramMonthLabel(now, "np");
    const monthEn = bikramMonthLabel(now, "en");
    const names = (list: Product[]) =>
      list.slice(0, 2).map((product) => product.name).join(", ") + (list.length > 2 ? ` +${list.length - 2}` : "");

    const todos: Todo[] = [];
    if (soldOut.length) {
      todos.push({
        key: "sold-out",
        tone: "red",
        en: `${names(soldOut)} sold out`,
        ne: `${names(soldOut)} सकियो`,
        subEn: "0 pairs · make or buy",
        subNe: "0 जोडी · बनाउने वा किन्ने",
        href: "/admin/stock",
      });
    }
    if (newOrders.length) {
      todos.push({
        key: "orders",
        tone: "blue",
        en: `${newOrders.length} new ${newOrders.length === 1 ? "order" : "orders"} to send`,
        ne: `${newOrders.length} नयाँ अर्डर पठाउन बाँकी`,
        subEn: "Pack and send",
        subNe: "प्याक गरेर पठाउने",
        href: "/admin/orders",
      });
    }
    if (runningLow.length) {
      todos.push({
        key: "low",
        tone: "gold",
        en: `${names(runningLow)} running low`,
        ne: `${names(runningLow)} थोरै बाँकी`,
        subEn: "5 pairs or fewer",
        subNe: "५ जोडी वा कम",
        href: "/admin/stock",
      });
    }
    if (workerBalanceDue > 0) {
      todos.push({
        key: "wages",
        tone: "gold",
        en: `Wages ${money(workerBalanceDue)}`,
        ne: `कामदारको ज्याला रु. ${Math.round(workerBalanceDue).toLocaleString("en-IN")}`,
        subEn: "Still to pay",
        subNe: "तिर्न बाँकी",
        href: "/admin/operations/production-accounts/payments",
      });
    }
    if (mismatched) {
      todos.push({
        key: "places",
        tone: "gold",
        en: `${mismatched} ${mismatched === 1 ? "shoe's" : "shoes'"} place not matching`,
        ne: `${mismatched} जुत्ताको ठाउँ मिलेन`,
        subEn: "Factory / shop count",
        subNe: "कारखाना / पसलको गन्ती",
        href: "/admin/stock#put-right",
      });
    }
    // A reminder only on a day of work with nothing posted yet. Once pairs are
    // in stock the factory card says how many, and there is nothing left to do.
    if (todayStagePairs.length > 0 && todayStockPairs === 0) {
      todos.push({
        key: "post",
        tone: "gold",
        en: `Work done today (${todayStageLine}), none posted to stock`,
        ne: `आज काम भयो (${todayStageLine}), स्टकमा चढाउन बाँकी`,
        subEn: "Count the finished pairs and post them to stock",
        subNe: "तयार जोडी गनेर स्टकमा चढाउने",
        href: "/admin/factory/add-work",
      });
    }
    if (!businessGoal || businessGoal.salesGoal <= 0) {
      todos.push({
        key: "goal",
        tone: "gold",
        en: `No goal set for ${monthEn}`,
        ne: `${monthNe} को लक्ष्य राखिएको छैन`,
        subEn: "Set a sales goal",
        subNe: "बिक्रीको लक्ष्य राख्ने",
        href: "/admin/settings#goals",
      });
    }

    const shoes = [...active]
      .sort((a, b) => (a.stock || 0) - (b.stock || 0) === 0 ? a.name.localeCompare(b.name) : (b.stock || 0) - (a.stock || 0))
      .slice(0, 7);
    // Sold-out shoes are the point of the list; keep them on it.
    for (const product of soldOut) {
      if (!shoes.includes(product)) shoes.push(product);
    }

    return (
      <section className="p-4 sm:p-6">
        {/* collected={todayCollected}: net of returns, beside what was actually
            taken in — a good day of credit sales is not a good day. */}
        <OwnerDashboard
          dateEn={toBikramSambatRoman(now)}
          dateNe={toBikramSambatNepali(now)}
          monthEn={monthEn}
          monthNe={monthNe}
          today={{
            net: todayNetSales,
            bills: billCount,
            pairs: todayPairsSold,
            retail: channel("Retail"),
            wholesale: channel("Wholesale"),
            online: channel("Online"),
            newOrders: newOrders.length,
          }}
          collected={todayCollected}
          week={weekNet}
          month={monthNet}
          salesGoal={businessGoal?.salesGoal ?? 0}
          daysInMonth={bsMonth?.daysInMonth ?? 30}
          todos={todos}
          kpis={{
            salesLessPurchases,
            stockValue: stockAtSellingPrice(active),
            stockPairs: active.reduce((sum, product) => sum + Math.max(0, product.stock || 0), 0),
            creditOwed,
            workerDue: workerBalanceDue,
          }}
          shoes={shoes.map((product) => ({ name: product.name, stock: product.stock || 0 }))}
          factory={{
            todayPairs: todayStockPairs,
            stages: todayStagePairs,
            atFactory: places.reduce((sum, row) => sum + row.factory, 0),
            atShop: places.reduce((sum, row) => sum + row.shop, 0),
            mismatched,
          }}
          days={days}
        />
      </section>
    );
  }

  // Everybody else: their own counter, what needs doing, and the quick jobs.
  return (
    <section className="p-6 space-y-6">
      <StaffToday
        name={session?.name ?? ""}
        role={adminAccess.role}
        billsToday={billCount}
        soldToday={todayNetSales}
        creditToday={creditToday}
        ordersToSend={newOrders.length}
      />

      {/* What needs doing, before anything else. */}
      <TodayBoard
        todayPairs={todayStockPairs}
        newOrders={newOrders.length}
        lowStockNames={lowStockProducts.map((product) => product.name)}
        workerDue={workerBalanceDue}
      />

      {/* छिटो काम — the jobs done most often, one tap each. */}
      <section>
        <h2 className="mb-3 font-display text-xl font-black text-brand-green-ink">
          <AlertText en="Quick jobs" ne="छिटो काम" />
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickTiles.map((tile) => (
            <QuickTile key={tile.href + tile.labelEn} {...tile} />
          ))}
        </div>
      </section>
    </section>
  );
}

function addOneDay(key: string) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
