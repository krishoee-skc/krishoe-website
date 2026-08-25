import { queryPostgres } from "@/lib/postgres/client";

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
 * offers the button that starts. Five of the eleven are empty today, and that
 * is a fact about the shop's first weeks rather than a fault in the screen.
 *
 * Counts come from one query. Eleven separate loads on a page whose whole job
 * is to be opened quickly would be its own kind of joke.
 */
export type ReportCard = {
  id: string;
  href: string;
  /** What the report answers, in the shop's own words. */
  titleNe: string;
  titleEn: string;
  detailNe: string;
  detailEn: string;
  /** The one number worth putting on the card, already counted. */
  value: number;
  /** What that number counts — pairs, bills, visits. */
  unitNe: string;
  unitEn: string;
  ready: boolean;
  /** What would fill it, said as an instruction rather than an apology. */
  emptyNe: string;
  emptyEn: string;
  /** Where that instruction leads. */
  actionHref: string;
  actionNe: string;
  actionEn: string;
};

type Counts = {
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

async function countEverything(): Promise<Counts> {
  const rows = await queryPostgres<Counts>(
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
       (SELECT count(*) FROM factory_workers)::int AS workers`,
  );

  return rows[0] ?? EMPTY;
}

export async function getReportIndex(): Promise<{ cards: ReportCard[]; counts: Counts }> {
  const counts = await countEverything().catch(() => EMPTY);

  const cards: ReportCard[] = [
    {
      id: "channels",
      href: "/admin/reports/channels",
      titleNe: "कहाँबाट आयो",
      titleEn: "Where they came from",
      detailNe: "Facebook, Instagram, Google — कुनबाट कति",
      detailEn: "Facebook, Instagram, Google — how many from each",
      value: 0,
      unitNe: "भ्रमण",
      unitEn: "visits",
      ready: true,
      emptyNe: "",
      emptyEn: "",
      actionHref: "/admin/reports/channels",
      actionNe: "हेर्ने",
      actionEn: "Open",
    },
    {
      id: "sales",
      href: "/admin/analytics",
      titleNe: "बिक्री र नाफा",
      titleEn: "Sales and profit",
      detailNe: "कति बिक्यो, के बिक्यो, कहिले",
      detailEn: "What sold, how much, when",
      value: counts.pos_invoices,
      unitNe: "बिल",
      unitEn: "bills",
      ready: counts.pos_invoices > 0,
      emptyNe: "पहिलो बिल काटेपछि यो भरिन्छ।",
      emptyEn: "This fills once the first bill is written.",
      actionHref: "/admin/pos",
      actionNe: "बिल काट्ने",
      actionEn: "Write a bill",
    },
    {
      id: "dues",
      href: "/admin/dues",
      titleNe: "उधारो",
      titleEn: "Credit owed",
      detailNe: "कसले कति तिर्न बाँकी",
      detailEn: "Who owes what, and for how long",
      value: counts.ledger_balance,
      unitNe: "रुपैयाँ",
      unitEn: "rupees",
      ready: counts.ledger_balance > 0,
      emptyNe: "कसैको उधारो बाँकी छैन — यो खाली हुनु राम्रो कुरा हो।",
      emptyEn: "Nobody owes anything. This one is good empty.",
      actionHref: "/admin/pos",
      actionNe: "बिल काट्ने",
      actionEn: "Write a bill",
    },
    {
      id: "speed",
      href: "/admin/monitoring",
      titleNe: "पाना कति छिटो",
      titleEn: "How fast the shop feels",
      detailNe: "ग्राहककै फोनमा नापिएको",
      detailEn: "Measured on the shopper's own phone",
      value: counts.performance,
      unitNe: "नाप",
      unitEn: "readings",
      ready: counts.performance > 0,
      emptyNe: "ग्राहक आएपछि आफैँ नापिन्छ।",
      emptyEn: "It measures itself once shoppers arrive.",
      actionHref: "/admin/reports/channels",
      actionNe: "ग्राहक ल्याउने",
      actionEn: "Bring shoppers",
    },
    {
      id: "activity",
      href: "/admin/activity",
      titleNe: "को ले के गर्‍यो",
      titleEn: "Who did what",
      detailNe: "हरेक बिल, हरेक सम्पादन, कहिले र कसले",
      detailEn: "Every bill and every edit, by whom and when",
      value: counts.audit,
      unitNe: "काम",
      unitEn: "actions",
      ready: counts.audit > 0,
      emptyNe: "काम सुरु भएपछि आफैँ टिपिन्छ।",
      emptyEn: "It records itself as work happens.",
      actionHref: "/admin",
      actionNe: "मुख्य पाना",
      actionEn: "Dashboard",
    },
    {
      id: "stock",
      href: "/admin/stock",
      titleNe: "स्टकको चाल",
      titleEn: "Stock movement",
      detailNe: "कहाँबाट आयो, कहाँ गयो",
      detailEn: "Where it came from and where it went",
      value: counts.stock_moves,
      unitNe: "चाल",
      unitEn: "movements",
      ready: counts.stock_moves > 0,
      emptyNe: "माल भित्रिएपछि वा बिकेपछि देखिन्छ।",
      emptyEn: "Appears once stock arrives or sells.",
      actionHref: "/admin/operations",
      actionNe: "स्टक हाल्ने",
      actionEn: "Add stock",
    },
    {
      id: "factory",
      href: "/admin/factory/reports",
      titleNe: "कारखानाको महिना",
      titleEn: "The factory's month",
      detailNe: "कसले कति बनायो, कति ज्याला",
      detailEn: "Who made how many, and what it earned them",
      value: counts.factory_work,
      unitNe: "entry",
      unitEn: "entries",
      ready: counts.factory_work > 0,
      emptyNe: `${counts.workers} जना कामदार छन्, तर दैनिक काम टिपिएको छैन।`,
      emptyEn: `${counts.workers} workers are on the list, but no daily work is recorded.`,
      actionHref: "/admin/factory/add-work",
      actionNe: "काम टिप्ने",
      actionEn: "Add work",
    },
    {
      id: "workers",
      href: "/admin/workers/analytics",
      titleNe: "कामदारको काम",
      titleEn: "How each worker is doing",
      detailNe: "कसले कति बनायो, कति कमायो",
      detailEn: "Pairs made and wages earned, per person",
      value: counts.factory_work,
      unitNe: "entry",
      unitEn: "entries",
      ready: counts.factory_work > 2,
      emptyNe: "केही दिन काम टिपेपछि तुलना गर्न मिल्छ।",
      emptyEn: "A few days of entries make this comparable.",
      actionHref: "/admin/factory/add-work",
      actionNe: "काम टिप्ने",
      actionEn: "Add work",
    },
    {
      id: "costing",
      href: "/admin/costing",
      titleNe: "साँचो नाफा",
      titleEn: "Real profit",
      detailNe: "कच्चा पदार्थको भाउ घटाएर बाँकी",
      detailEn: "What is left after what the materials cost",
      value: counts.purchases,
      unitNe: "किनमेल",
      unitEn: "purchases",
      ready: counts.purchases > 0,
      emptyNe: "किनमेलको एउटा बिल हाल्नुहोस् — भाउ थाहा भएपछि नाफा आफैँ गनिन्छ।",
      emptyEn: "Enter one purchase bill; profit counts itself once material costs are known.",
      actionHref: "/admin/purchasing",
      actionNe: "किनमेल हाल्ने",
      actionEn: "Add a purchase",
    },
    {
      id: "voice",
      href: "/admin/insights",
      titleNe: "कुन जुत्ता राम्रो",
      titleEn: "Which shoe people like",
      detailNe: "ग्राहकको राय र फिर्ताबाट",
      detailEn: "From reviews and returns",
      value: counts.reviews,
      unitNe: "राय",
      unitEn: "reviews",
      ready: counts.reviews > 0,
      emptyNe: "अर्डर पुगेको एक हप्तापछि ग्राहकलाई आफैँ सोधिन्छ।",
      emptyEn: "Buyers are asked automatically, a week after delivery.",
      actionHref: "/admin/inbox",
      actionNe: "ग्राहकको आवाज",
      actionEn: "Customer voice",
    },
    {
      id: "customers",
      href: "/admin/customers",
      titleNe: "ग्राहकको हिसाब",
      titleEn: "The customers",
      detailNe: "दोहोरिने ग्राहक, औसत अर्डर",
      detailEn: "Repeat buyers and average order",
      value: counts.orders,
      unitNe: "अर्डर",
      unitEn: "orders",
      ready: counts.orders > 0,
      emptyNe: "पहिलो अनलाइन अर्डरपछि चल्छ।",
      emptyEn: "Starts working after the first online order.",
      actionHref: "/admin/reports/channels",
      actionNe: "ग्राहक ल्याउने",
      actionEn: "Bring shoppers",
    },
  ];

  return { cards, counts };
}

/**
 * The one thing worth saying before the eleven cards.
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

export function buildInsight(counts: Counts): ReportInsight {
  // Shoes that cannot be bought, on a shop about to be advertised. The two
  // halves live on different screens and neither one alone says this.
  if (counts.out_of_stock > 0) {
    return {
      titleNe: `${counts.out_of_stock} जुत्ता पसलमा "सकियो" देखिन्छ`,
      titleEn: `${counts.out_of_stock} shoes show as sold out`,
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
