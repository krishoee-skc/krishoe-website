import { queryPostgres } from "@/lib/postgres/client";
import {
  NEPAL_TIME_ZONE,
  bikramMonthStartAdKey,
  bikramYearMonth,
  toBikramSambatNumeric,
} from "@/lib/bikram-sambat";

/**
 * Every way this shop can look at itself, in one list.
 *
 * Eleven analysis screens had been built and six of them were hard to reach:
 * four were in no menu at all, and two — monitoring and the activity log —
 * lived only inside Settings, which is where a shopkeeper looks once and never
 * again. A report nobody can find is a report nobody reads.
 *
 * The list is deliberately honest about which ones have anything in them. A
 * screen with no data does not say "No data" — it says what would fill it and
 * offers the button that starts.
 *
 * The owner's sample, 2026-09-28: the cards counted bills and entries since the
 * first day, with no way to ask about today or this month and no rupees on the
 * money cards. Now a period is chosen at the top, the money cards lead with
 * rupees against the stretch before, the cards sit in four groups, and the two
 * factory cards that said the same thing are one. (The worker card used to
 * point at /admin/workers/analytics, a mock-data page; the factory report at
 * /admin/factory/reports carries the real pairs and wages per worker.)
 *
 * Counts come from one query. Eleven separate loads on a page whose whole job
 * is to be opened quickly would be its own kind of joke.
 */
export type ReportGroup = "money" | "factory" | "shop" | "app";

export type ReportCard = {
  id: string;
  group: ReportGroup;
  href: string;
  /** What the report answers, in the shop's own words. */
  titleNe: string;
  titleEn: string;
  detailNe: string;
  detailEn: string;
  /** The one number worth putting on the card, already counted. */
  value: number;
  /** Rupees, a plain count, or no number at all (a report kept elsewhere). */
  valueKind: "money" | "count" | "none";
  /** What that number counts — pairs, bills, visits. */
  unitNe: string;
  unitEn: string;
  /** A second line under the number: "10 bills", "+60 in · −47 out". */
  subNe: string;
  subEn: string;
  /** Against the stretch before, as a whole percent; null when it cannot be said. */
  change: number | null;
  ready: boolean;
  /** What would fill it, said as an instruction rather than an apology. */
  emptyNe: string;
  emptyEn: string;
  /** Where that instruction leads. */
  actionHref: string;
  actionNe: string;
  actionEn: string;
};

export type Counts = {
  pos_invoices: number;
  ledger_balance: number;
  performance: number;
  audit: number;
  stock_moves: number;
  factory_work: number;
  reviews: number;
  purchases: number;
  orders: number;
  out_of_stock: number;
  workers: number;
};

/** The same things, inside the chosen stretch, plus what the cards say in rupees and pairs. */
type Figures = {
  sales_net: number;
  sales_bills: number;
  prev_sales_net: number;
  purchase_total: number;
  purchase_bills: number;
  prev_purchase_total: number;
  factory_pairs: number;
  factory_wages: number;
  factory_entries: number;
  stock_in: number;
  stock_out: number;
  period_orders: number;
  period_order_total: number;
  period_performance: number;
  period_audit: number;
  costed_shoes: number;
  out_of_stock_names: string | null;
};

const EMPTY: Counts = {
  pos_invoices: 0,
  ledger_balance: 0,
  performance: 0,
  audit: 0,
  stock_moves: 0,
  factory_work: 0,
  reviews: 0,
  purchases: 0,
  orders: 0,
  out_of_stock: 0,
  workers: 0,
};

const EMPTY_FIGURES: Figures = {
  sales_net: 0,
  sales_bills: 0,
  prev_sales_net: 0,
  purchase_total: 0,
  purchase_bills: 0,
  prev_purchase_total: 0,
  factory_pairs: 0,
  factory_wages: 0,
  factory_entries: 0,
  stock_in: 0,
  stock_out: 0,
  period_orders: 0,
  period_order_total: 0,
  period_performance: 0,
  period_audit: 0,
  costed_shoes: 0,
  out_of_stock_names: null,
};

// ── The stretch ──────────────────────────────────────────────────────────

export type ReportPeriod = "today" | "week" | "month" | "last" | "all";

export const REPORT_PERIODS: Array<{ key: ReportPeriod; en: string; ne: string }> = [
  { key: "today", en: "Today", ne: "आज" },
  { key: "week", en: "Last 7 days", ne: "७ दिन" },
  { key: "month", en: "This month", ne: "यो महिना" },
  { key: "last", en: "Last month", ne: "गत महिना" },
  { key: "all", en: "All", ne: "सबै" },
];

export function readPeriod(value: string | undefined): ReportPeriod {
  return REPORT_PERIODS.some((period) => period.key === value) ? (value as ReportPeriod) : "month";
}

type Range = { startKey: string; endKey: string };

export type PeriodWindow = {
  period: ReportPeriod;
  /** Half-open [start, end) in Nepal dates; null for "all". */
  current: Range | null;
  /** The stretch it is compared with; null when there is none. */
  previous: Range | null;
  /** "2083/06/01 – 2083/06/12", or "" for all. */
  rangeLabel: string;
};

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NEPAL_TIME_ZONE }).format(date);
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startKey: string, endKey: string) {
  return Math.round((Date.parse(`${endKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86_400_000);
}

function bsMonthStart(year: number, monthIndex: number) {
  let y = year;
  let m = monthIndex;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  while (m > 11) {
    m -= 12;
    y += 1;
  }
  return bikramMonthStartAdKey(y, m);
}

/**
 * The dates a period covers, in Nepal time. "This month" is the Bikram Sambat
 * month so far, compared with the same number of days at the start of the
 * month before — a month half gone against a whole one would always look bad.
 */
export function periodWindow(period: ReportPeriod, now: Date = new Date()): PeriodWindow {
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  let current: Range | null = null;
  let previous: Range | null = null;

  if (period === "today") {
    current = { startKey: today, endKey: tomorrow };
    previous = { startKey: addDays(today, -1), endKey: today };
  } else if (period === "week") {
    current = { startKey: addDays(today, -6), endKey: tomorrow };
    previous = { startKey: addDays(today, -13), endKey: addDays(today, -6) };
  } else if (period === "month" || period === "last") {
    const bs = bikramYearMonth(today);
    if (bs) {
      const shift = period === "last" ? -1 : 0;
      const start = bsMonthStart(bs.year, bs.monthIndex + shift);
      const nextStart = bsMonthStart(bs.year, bs.monthIndex + shift + 1);
      const prevStart = bsMonthStart(bs.year, bs.monthIndex + shift - 1);
      if (start && nextStart && prevStart) {
        const end = period === "month" ? tomorrow : nextStart;
        current = { startKey: start, endKey: end };
        const length = daysBetween(start, end);
        const prevEnd = period === "month" ? addDays(prevStart, Math.min(length, daysBetween(prevStart, start))) : start;
        previous = { startKey: prevStart, endKey: prevEnd };
      }
    }
  }

  const rangeLabel = current
    ? `${toBikramSambatNumeric(current.startKey)} – ${toBikramSambatNumeric(addDays(current.endKey, -1))}`
    : "";
  return { period, current, previous, rangeLabel };
}

// ── The one query ────────────────────────────────────────────────────────

/** A timestamp column inside a range held in two parameters, in Nepal dates. */
function within(column: string, start: string, end: string) {
  const day = `(${column} AT TIME ZONE '${NEPAL_TIME_ZONE}')::date`;
  return `(${start}::date IS NULL OR ${day} >= ${start}::date) AND (${end}::date IS NULL OR ${day} < ${end}::date)`;
}

/** A DATE column (factory work) inside a range. */
function withinDate(column: string, start: string, end: string) {
  return `(${start}::date IS NULL OR ${column} >= ${start}::date) AND (${end}::date IS NULL OR ${column} < ${end}::date)`;
}

const NET_SALE = `CASE WHEN kind = 'Return' THEN -total ELSE total END`;

async function countEverything(window: PeriodWindow): Promise<Counts & Figures> {
  const rows = await queryPostgres<Counts & Figures>(
    "reports",
    `SELECT
       (SELECT count(*) FROM pos_invoices)::int AS pos_invoices,
       (SELECT coalesce(sum(balance_due), 0) FROM customer_ledgers)::int AS ledger_balance,
       (SELECT count(*) FROM monitoring_performance WHERE environment = 'production')::int AS performance,
       (SELECT count(*) FROM admin_audit_events)::int AS audit,
       (SELECT count(*) FROM stock_movements)::int AS stock_moves,
       (SELECT count(*) FROM factory_daily_work)::int AS factory_work,
       (SELECT count(*) FROM customer_voice)::int AS reviews,
       (SELECT count(*) FROM purchase_invoices)::int AS purchases,
       (SELECT count(*) FROM orders)::int AS orders,
       (SELECT count(*) FROM products WHERE status = 'Active' AND stock <= 0)::int AS out_of_stock,
       (SELECT count(*) FROM factory_workers)::int AS workers,

       (SELECT coalesce(sum(${NET_SALE}), 0) FROM pos_invoices
         WHERE status <> 'Voided' AND ${within("created_at", "$1", "$2")})::float AS sales_net,
       (SELECT count(*) FROM pos_invoices
         WHERE status <> 'Voided' AND kind = 'Sale' AND ${within("created_at", "$1", "$2")})::int AS sales_bills,
       (SELECT coalesce(sum(${NET_SALE}), 0) FROM pos_invoices
         WHERE $3::date IS NOT NULL AND status <> 'Voided' AND ${within("created_at", "$3", "$4")})::float AS prev_sales_net,
       (SELECT coalesce(sum(total), 0) FROM purchase_invoices
         WHERE ${within("created_at", "$1", "$2")})::float AS purchase_total,
       (SELECT count(*) FROM purchase_invoices
         WHERE ${within("created_at", "$1", "$2")})::int AS purchase_bills,
       (SELECT coalesce(sum(total), 0) FROM purchase_invoices
         WHERE $3::date IS NOT NULL AND ${within("created_at", "$3", "$4")})::float AS prev_purchase_total,
       (SELECT coalesce(sum(pairs_count), 0) FROM factory_daily_work
         WHERE status <> 'reversed' AND ${withinDate("date", "$1", "$2")})::int AS factory_pairs,
       (SELECT coalesce(sum(amount_earned), 0) FROM factory_daily_work
         WHERE status <> 'reversed' AND ${withinDate("date", "$1", "$2")})::float AS factory_wages,
       (SELECT count(*) FROM factory_daily_work
         WHERE status <> 'reversed' AND ${withinDate("date", "$1", "$2")})::int AS factory_entries,
       (SELECT coalesce(sum(pairs), 0) FROM stock_movements
         WHERE type IN ('Production In', 'Purchase In', 'Return In') AND NOT (type = 'Return In' AND note LIKE '% cancelled — test bill')
           AND ${within("created_at", "$1", "$2")})::int AS stock_in,
       (SELECT coalesce(sum(pairs), 0) FROM stock_movements
         WHERE type IN ('Sale Out', 'Market Sale', 'Dispatch Out', 'Damage Out')
           AND NOT (type = 'Sale Out' AND split_part(note, ' ', 1) IN (
             SELECT split_part(note, ' ', 1) FROM stock_movements WHERE type = 'Return In' AND note LIKE '% cancelled — test bill' LIMIT 500))
           AND ${within("created_at", "$1", "$2")})::int AS stock_out,
       (SELECT count(*) FROM orders WHERE ${within("created_at", "$1", "$2")})::int AS period_orders,
       (SELECT coalesce(sum(total_paisa), 0) / 100.0 FROM orders WHERE ${within("created_at", "$1", "$2")})::float AS period_order_total,
       (SELECT count(*) FROM monitoring_performance
         WHERE environment = 'production' AND ${within("created_at", "$1", "$2")})::int AS period_performance,
       (SELECT count(*) FROM admin_audit_events WHERE ${within("created_at", "$1", "$2")})::int AS period_audit,
       (SELECT count(DISTINCT item_id) FROM production_cost_cards)::int AS costed_shoes,
       (SELECT string_agg(name, ', ' ORDER BY name) FROM (
          SELECT name FROM products WHERE status = 'Active' AND stock <= 0 ORDER BY name LIMIT 3
        ) sold_out) AS out_of_stock_names`,
    [
      window.current?.startKey ?? null,
      window.current?.endKey ?? null,
      window.previous?.startKey ?? null,
      window.previous?.endKey ?? null,
    ],
  );

  return rows[0] ?? { ...EMPTY, ...EMPTY_FIGURES };
}

function changeOf(now: number, before: number) {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

export async function getReportIndex(
  period: ReportPeriod = "month",
): Promise<{ cards: ReportCard[]; counts: Counts; window: PeriodWindow; soldOutNames: string }> {
  const window = periodWindow(period);
  const all = await countEverything(window).catch(() => ({ ...EMPTY, ...EMPTY_FIGURES }));
  const counts: Counts = {
    pos_invoices: all.pos_invoices,
    ledger_balance: all.ledger_balance,
    performance: all.performance,
    audit: all.audit,
    stock_moves: all.stock_moves,
    factory_work: all.factory_work,
    reviews: all.reviews,
    purchases: all.purchases,
    orders: all.orders,
    out_of_stock: all.out_of_stock,
    workers: all.workers,
  };
  const compare = window.previous !== null;

  const blank = { subNe: "", subEn: "", change: null as number | null };

  const cards: ReportCard[] = [
    // ── 💰 Money ─────────────────────────────────────────────────────────
    {
      id: "sales",
      group: "money",
      href: "/admin/analytics",
      titleNe: "बिक्री",
      titleEn: "Sales",
      detailNe: "कति बिक्यो, के बिक्यो, कहिले — फिर्ता घटाएर",
      detailEn: "What sold, how much, when — returns taken off",
      value: all.sales_net,
      valueKind: "money",
      unitNe: "",
      unitEn: "",
      subNe: `${all.sales_bills} बिल`,
      subEn: `${all.sales_bills} bills`,
      change: compare ? changeOf(all.sales_net, all.prev_sales_net) : null,
      ready: counts.pos_invoices > 0,
      emptyNe: "पहिलो बिल काटेपछि यो भरिन्छ।",
      emptyEn: "This fills once the first bill is written.",
      actionHref: "/admin/pos",
      actionNe: "बिल काट्ने",
      actionEn: "Write a bill",
    },
    {
      id: "purchases",
      group: "money",
      href: "/admin/purchasing?view=accounts",
      titleNe: "खरिद",
      titleEn: "Bought",
      detailNe: "साहुका बिल — कच्चा माल र जुत्ता/चप्पल",
      detailEn: "Supplier bills — material and shoes/slippers",
      value: all.purchase_total,
      valueKind: "money",
      unitNe: "",
      unitEn: "",
      subNe: `${all.purchase_bills} बिल`,
      subEn: `${all.purchase_bills} bills`,
      change: compare ? changeOf(all.purchase_total, all.prev_purchase_total) : null,
      ready: counts.purchases > 0,
      emptyNe: "किनमेलको पहिलो बिल हालेपछि भरिन्छ।",
      emptyEn: "Fills once the first purchase bill is entered.",
      actionHref: "/admin/purchasing",
      actionNe: "किनमेल हाल्ने",
      actionEn: "Add a purchase",
    },
    {
      id: "dues",
      group: "money",
      href: "/admin/dues",
      titleNe: "उधारो बाँकी",
      titleEn: "Credit owed",
      detailNe: "कसले कति तिर्न बाँकी — आजसम्मको",
      detailEn: "Who owes what, as of today",
      value: counts.ledger_balance,
      valueKind: "money",
      unitNe: "",
      unitEn: "",
      ...blank,
      ready: counts.ledger_balance > 0,
      emptyNe: "कसैको उधारो बाँकी छैन — यो खाली हुनु राम्रो कुरा हो।",
      emptyEn: "Nobody owes anything. This one is good empty.",
      actionHref: "/admin/pos",
      actionNe: "बिल काट्ने",
      actionEn: "Write a bill",
    },
    {
      id: "costing",
      group: "money",
      href: "/admin/costing",
      titleNe: "साँचो नाफा",
      titleEn: "Real profit",
      detailNe: "एक जोडीको लागत थाहा भएका जुत्ताको नाफा",
      detailEn: "Profit on the shoes whose cost of a pair is known",
      value: all.costed_shoes,
      valueKind: "count",
      unitNe: "जुत्ताको लागत निकालिएको",
      unitEn: "shoes costed",
      ...blank,
      // Profit in rupees needs what a pair costs; until one shoe is costed
      // this says so rather than showing sales less purchases as profit.
      ready: all.costed_shoes > 0,
      emptyNe: "एक जोडीको लागत भर्न बाँकी — लागत नभरेसम्म नाफा गनिँदैन।",
      emptyEn: "Cost of a pair not entered yet — profit is not counted until it is.",
      actionHref: "/admin/operations/production-accounts/lots",
      actionNe: "लागत भर्ने",
      actionEn: "Enter the cost",
    },

    // ── 🏭 Factory ──────────────────────────────────────────────────────
    {
      id: "factory",
      group: "factory",
      href: "/admin/factory/reports",
      titleNe: "कारखानाको काम र कामदार",
      titleEn: "The factory's work and workers",
      detailNe: "कसले कति बनायो, कति ज्याला — कामदार अनुसार",
      detailEn: "Who made how many and what it earned them, per worker",
      value: all.factory_pairs,
      valueKind: "count",
      unitNe: "जोडी",
      unitEn: "pairs",
      subNe: `${all.factory_entries} पटक टिपिएको · ज्याला रु. ${Math.round(all.factory_wages).toLocaleString("en-IN")}`,
      subEn: `${all.factory_entries} entries · wages Rs. ${Math.round(all.factory_wages).toLocaleString("en-IN")}`,
      change: null,
      ready: counts.factory_work > 0,
      emptyNe: `${counts.workers} जना कामदार छन्, तर दैनिक काम टिपिएको छैन।`,
      emptyEn: `${counts.workers} workers are on the list, but no daily work is recorded.`,
      actionHref: "/admin/factory/add-work",
      actionNe: "काम टिप्ने",
      actionEn: "Add work",
    },
    {
      id: "stock",
      group: "factory",
      href: "/admin/stock",
      titleNe: "स्टकको चाल",
      titleEn: "Stock movement",
      detailNe: "आएको र गएको जोडी",
      detailEn: "Pairs in and pairs out",
      value: all.stock_in - all.stock_out,
      valueKind: "count",
      unitNe: "जोडी फरक",
      unitEn: "pairs net",
      subNe: `+${all.stock_in} आयो · −${all.stock_out} गयो`,
      subEn: `+${all.stock_in} in · −${all.stock_out} out`,
      change: null,
      ready: counts.stock_moves > 0,
      emptyNe: "माल भित्रिएपछि वा बिकेपछि देखिन्छ।",
      emptyEn: "Appears once stock arrives or sells.",
      actionHref: "/admin/operations",
      actionNe: "स्टक हाल्ने",
      actionEn: "Add stock",
    },

    // ── 🛒 Shop and customers ───────────────────────────────────────────
    {
      id: "customers",
      group: "shop",
      href: "/admin/customers",
      titleNe: "अनलाइन अर्डर",
      titleEn: "Online orders",
      detailNe: "दोहोरिने ग्राहक, औसत अर्डर",
      detailEn: "Repeat buyers and average order",
      value: all.period_orders,
      valueKind: "count",
      unitNe: "अर्डर",
      unitEn: "orders",
      subNe: all.period_order_total ? `रु. ${Math.round(all.period_order_total).toLocaleString("en-IN")}` : "",
      subEn: all.period_order_total ? `Rs. ${Math.round(all.period_order_total).toLocaleString("en-IN")}` : "",
      change: null,
      ready: counts.orders > 0,
      emptyNe: "पहिलो अनलाइन अर्डरपछि चल्छ।",
      emptyEn: "Starts working after the first online order.",
      actionHref: "/admin/reports/channels",
      actionNe: "ग्राहक ल्याउने",
      actionEn: "Bring shoppers",
    },
    {
      // Visits are read from Google Analytics on that page, not from this
      // database, so the card carries no number rather than a false 0.
      id: "channels",
      group: "shop",
      href: "/admin/reports/channels",
      titleNe: "कहाँबाट आयो",
      titleEn: "Where they came from",
      detailNe: "Facebook, Instagram, Google — कुनबाट कति (Google Analytics बाट)",
      detailEn: "Facebook, Instagram, Google — how many from each (from Google Analytics)",
      value: 0,
      valueKind: "none",
      unitNe: "",
      unitEn: "",
      ...blank,
      ready: true,
      emptyNe: "",
      emptyEn: "",
      actionHref: "/admin/reports/channels",
      actionNe: "हेर्ने",
      actionEn: "Open",
    },
    {
      id: "voice",
      group: "shop",
      href: "/admin/insights",
      titleNe: "कुन जुत्ता राम्रो",
      titleEn: "Which shoe people like",
      detailNe: "ग्राहकको राय र फिर्ताबाट",
      detailEn: "From reviews and returns",
      value: counts.reviews,
      valueKind: "count",
      unitNe: "राय",
      unitEn: "reviews",
      ...blank,
      ready: counts.reviews > 0,
      emptyNe: "अर्डर पुगेको एक हप्तापछि ग्राहकलाई आफैँ सोधिन्छ।",
      emptyEn: "Buyers are asked automatically, a week after delivery.",
      actionHref: "/admin/inbox",
      actionNe: "ग्राहकको आवाज",
      actionEn: "Customer voice",
    },

    // ── ⚙️ The app itself ───────────────────────────────────────────────
    {
      id: "speed",
      group: "app",
      href: "/admin/monitoring",
      titleNe: "पाना कति छिटो",
      titleEn: "How fast the shop feels",
      detailNe: "ग्राहककै फोनमा नापिएको",
      detailEn: "Measured on the shopper's own phone",
      value: all.period_performance,
      valueKind: "count",
      unitNe: "नाप",
      unitEn: "readings",
      ...blank,
      ready: counts.performance > 0,
      emptyNe: "ग्राहक आएपछि आफैँ नापिन्छ।",
      emptyEn: "It measures itself once shoppers arrive.",
      actionHref: "/admin/reports/channels",
      actionNe: "ग्राहक ल्याउने",
      actionEn: "Bring shoppers",
    },
    {
      id: "activity",
      group: "app",
      href: "/admin/activity",
      titleNe: "को ले के गर्‍यो",
      titleEn: "Who did what",
      detailNe: "हरेक बिल, हरेक सम्पादन, कहिले र कसले",
      detailEn: "Every bill and every edit, by whom and when",
      value: all.period_audit,
      valueKind: "count",
      unitNe: "काम",
      unitEn: "actions",
      ...blank,
      ready: counts.audit > 0,
      emptyNe: "काम सुरु भएपछि आफैँ टिपिन्छ।",
      emptyEn: "It records itself as work happens.",
      actionHref: "/admin",
      actionNe: "मुख्य पाना",
      actionEn: "Dashboard",
    },
  ];

  return { cards, counts, window, soldOutNames: all.out_of_stock_names ?? "" };
}

/**
 * The one thing worth saying before the cards.
 *
 * Not a summary — a summary of eleven numbers is a twelfth number nobody reads.
 * This is the single fact the shop should act on today, worked out by joining
 * two things the owner would otherwise have to notice separately.
 */
export type ReportInsight = {
  titleNe: string;
  titleEn: string;
  detailNe: string;
  detailEn: string;
  href: string;
  actionNe: string;
  actionEn: string;
} | null;

export function buildInsight(counts: Counts, soldOutNames = ""): ReportInsight {
  // Shoes that cannot be bought, on a shop about to be advertised. The two
  // halves live on different screens and neither one alone says this.
  if (counts.out_of_stock > 0) {
    const one = counts.out_of_stock === 1;
    const more = counts.out_of_stock > 3 ? ` +${counts.out_of_stock - 3}` : "";
    const names = soldOutNames ? `: ${soldOutNames}${more}` : "";
    return {
      titleNe: `${counts.out_of_stock} जुत्ता पसलमा "सकियो" देखिन्छ${names}`,
      titleEn: `${counts.out_of_stock} ${one ? "shoe shows" : "shoes show"} as sold out${names}`,
      detailNe:
        "विज्ञापन गर्नुअघि यीको स्टक हालिदिनुहोस् — नत्र आएको ग्राहक खाली हात फर्किन्छ।",
      detailEn:
        "Put stock against these before advertising, or the shoppers you bring will leave empty-handed.",
      href: "/admin/operations",
      actionNe: "स्टक हाल्ने",
      actionEn: "Add stock",
    };
  }

  // A shop with stock and no purchase bills cannot tell profit from turnover.
  if (counts.purchases === 0 && counts.pos_invoices > 0) {
    return {
      titleNe: "बिक्री भइरहेको छ, तर नाफा गनिँदैन",
      titleEn: "Sales are happening, but profit is not being counted",
      detailNe:
        "किनमेलको बिल नभएसम्म कच्चा पदार्थको भाउ थाहा हुँदैन, र नाफा अनुमान मात्र रहन्छ।",
      detailEn:
        "Without purchase bills the material cost is unknown, so profit stays a guess.",
      href: "/admin/purchasing",
      actionNe: "किनमेल हाल्ने",
      actionEn: "Add a purchase",
    };
  }

  return null;
}
