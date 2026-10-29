import {
  BarChartIcon,
  BellIcon,
  CalculatorIcon,
  CameraIcon,
  CartPlusIcon,
  CashIcon,
  CoinsIcon,
  CreditCardIcon,
  FactoryIcon,
  GearIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  MenuIcon,
  MessageSquareIcon,
  PackageIcon,
  PencilIcon,
  ReturnIcon,
  RobotIcon,
  RulerIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparkleIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
} from "@/components/Icons";
import { canAccessAdminPath, canAdmin, type AdminPermission, type AdminRole } from "@/lib/admin-role-permissions";

/**
 * The simple menu (owner, 2026-10-29, the app-model namuna, "kha garau"):
 * five names on the side — Home, Sales, Money, Factory, All pages — and
 * behind each, the day's work as large buttons and everything else as small
 * ones. Purchasing sits with Money (his choice). The phone's dock is Bill ·
 * Sales · Stock · Add work · More.
 *
 * No page moved or changed: every button opens a page that already exists, at
 * the address it always had, so links, QR codes and ☆ favourites keep working.
 * One list here feeds the side menu, the phone's More sheet and the button
 * pages, so the three can never disagree.
 */

type Icon = typeof HomeIcon;

export type HubPage = { href: string; en: string; ne: string; icon: Icon };

export type HubId = "home" | "sales" | "money" | "factory" | "all";

export type Hub = {
  id: HubId;
  href: string;
  en: string;
  ne: string;
  icon: Icon;
  /** The day's work: large buttons at the top. */
  big: string[];
  /** Everything else that belongs here: small buttons. */
  rest: string[];
};

/** Every page a button can open, by its address. */
export const HUB_PAGES: Record<string, HubPage> = Object.fromEntries(
  (
    [
      { href: "/admin/pos", en: "Cut a bill", ne: "बिल काट्ने", icon: CreditCardIcon },
      { href: "/admin/transactions?v=in", en: "Money in", ne: "पैसा आयो", icon: CashIcon },
      { href: "/admin/transactions?v=out", en: "Money out", ne: "पैसा गयो", icon: CoinsIcon },
      { href: "/admin/purchasing", en: "Purchase bill", ne: "खरिद बिल", icon: CartPlusIcon },
      { href: "/admin/factory/add-work", en: "Add work", ne: "काम टिप्ने", icon: PencilIcon },
      { href: "/admin/orders", en: "Orders", ne: "अर्डर", icon: ShoppingCartIcon },
      { href: "/admin/pos?view=reports", en: "Bills and day close", ne: "बिल र दिन बन्द", icon: BarChartIcon },
      { href: "/admin/coupons", en: "Discount codes", ne: "छुटको कोड", icon: TagIcon },
      { href: "/admin/customers", en: "Customers", ne: "ग्राहक", icon: UserIcon },
      { href: "/admin/inbox", en: "Customer Voice", ne: "ग्राहकको आवाज", icon: MessageSquareIcon },
      { href: "/admin/wholesale", en: "Wholesale", ne: "थोकको सोधपुछ", icon: StoreIcon },
      { href: "/admin/reviews", en: "Reviews", ne: "राय", icon: StarIcon },
      { href: "/admin/feedback", en: "Feedback", ne: "सुझाव", icon: MessageSquareIcon },
      { href: "/admin/messages", en: "Messages", ne: "सन्देश", icon: MessageSquareIcon },
      { href: "/admin/products", en: "Item / Goods", ne: "सामान · मूल्य", icon: TagIcon },
      { href: "/admin/products/photos", en: "Product photos", ne: "सामानको फोटो", icon: ImageIcon },
      { href: "/admin/products/codes", en: "Codes", ne: "कोड", icon: TagIcon },
      { href: "/admin/products/labels", en: "Labels", ne: "लेबल", icon: TagIcon },
      { href: "/admin/stock", en: "Stock", ne: "कति माल छ", icon: LayersIcon },
      { href: "/admin/transactions", en: "Transactions · Day Book", ne: "कारोबार", icon: CashIcon },
      { href: "/admin/purchasing?view=accounts", en: "Suppliers and accounts", ne: "साहु र हिसाब", icon: TruckIcon },
      { href: "/admin/dues", en: "Credit / Dues", ne: "उधारो", icon: CoinsIcon },
      { href: "/admin/cheques", en: "Cheques", ne: "चेक खाता", icon: CreditCardIcon },
      { href: "/admin/payments", en: "Payments check", ne: "भुक्तानी मिलान", icon: CreditCardIcon },
      { href: "/admin/costing", en: "Costing", ne: "लागत", icon: CalculatorIcon },
      { href: "/admin/factory", en: "Factory today", ne: "कारखाना आज", icon: FactoryIcon },
      { href: "/admin/operations/production-accounts/payments", en: "Saturday payments", ne: "शनिबार भुक्तानी", icon: CoinsIcon },
      { href: "/admin/factory/photos", en: "Workers' photos", ne: "कामदारको फोटो", icon: CameraIcon },
      { href: "/admin/factory/workers", en: "Workers", ne: "कामदार", icon: UserIcon },
      { href: "/admin/factory/items", en: "Items and rates", ne: "item र दर", icon: RulerIcon },
      { href: "/admin/factory/ledger", en: "Worker ledger", ne: "कामदारको खाता", icon: LayersIcon },
      { href: "/admin/factory/salary", en: "Salary", ne: "तलब", icon: CoinsIcon },
      { href: "/admin/operations/production-accounts", en: "Wages this week", ne: "यो हप्ताको ज्याला", icon: CoinsIcon },
      { href: "/admin/operations/production-accounts/rates", en: "Wage rates", ne: "ज्याला दर", icon: RulerIcon },
      { href: "/admin/operations/production-accounts/lots", en: "Cost of a pair", ne: "जोडीको लागत", icon: CalculatorIcon },
      { href: "/admin/operations", en: "Operations", ne: "उत्पादन र स्टक", icon: PackageIcon },
      { href: "/admin/factory/reports", en: "Factory reports", ne: "कारखाना रिपोर्ट", icon: BarChartIcon },
      { href: "/admin/factory/worker-portal-qr", en: "QR poster", ne: "QR पोस्टर", icon: ImageIcon },
      { href: "/admin", en: "Dashboard", ne: "मुख्य पाना", icon: HomeIcon },
      { href: "/admin/reports", en: "All reports", ne: "सबै रिपोर्ट", icon: BarChartIcon },
      { href: "/admin/analytics", en: "Analytics", ne: "बिक्रीको नाप", icon: BarChartIcon },
      { href: "/admin/reports/channels", en: "Where shoppers came from", ne: "ग्राहक कहाँबाट", icon: BarChartIcon },
      { href: "/admin/insights", en: "Reviews and returns", ne: "राय र फिर्ता", icon: ReturnIcon },
      { href: "/admin/measurement", en: "Measurement setup", ne: "मापन सेटअप", icon: RulerIcon },
      { href: "/admin/settings", en: "Settings", ne: "सेटिङ", icon: GearIcon },
      { href: "/admin/getting-started", en: "Getting started", ne: "सुरु गर्ने", icon: SparkleIcon },
      { href: "/admin/settings/whatsapp", en: "WhatsApp setup", ne: "WhatsApp", icon: MessageSquareIcon },
      { href: "/admin/security-overview", en: "Security Center", ne: "सुरक्षा", icon: ShieldCheckIcon },
      { href: "/admin/security", en: "Camera", ne: "CCTV", icon: CameraIcon },
      { href: "/admin/devices", en: "Login devices", ne: "कुन फोन/computer", icon: ShieldCheckIcon },
      { href: "/admin/change-password", en: "Change password", ne: "पासवर्ड", icon: ShieldCheckIcon },
      { href: "/admin/activity", en: "Activity", ne: "को ले के गर्‍यो", icon: ShieldCheckIcon },
      { href: "/admin/alerts", en: "Alerts", ne: "चेतावनी", icon: BellIcon },
      { href: "/admin/notifications", en: "Notifications", ne: "सूचना", icon: BellIcon },
      { href: "/admin/sms", en: "SMS", ne: "मोबाइल सन्देश", icon: MessageSquareIcon },
      { href: "/admin/monitoring", en: "Monitoring", ne: "निगरानी", icon: ShieldCheckIcon },
      { href: "/admin/robots", en: "Robots", ne: "Robot दरबार", icon: RobotIcon },
    ] as HubPage[]
  ).map((page) => [page.href, page]),
);

export const HUBS: Hub[] = [
  {
    id: "home",
    href: "/admin/hub/home",
    en: "Home",
    ne: "आजको काम",
    icon: HomeIcon,
    big: ["/admin/pos", "/admin/transactions?v=in", "/admin/transactions?v=out", "/admin/purchasing", "/admin/factory/add-work"],
    rest: ["/admin/stock", "/admin/orders", "/admin/factory/photos", "/admin/transactions", "/admin/dues", "/admin"],
  },
  {
    id: "sales",
    href: "/admin/hub/sales",
    en: "Sales",
    ne: "बिक्री र ग्राहक",
    icon: ShoppingCartIcon,
    big: ["/admin/pos", "/admin/orders"],
    rest: [
      "/admin/pos?view=reports", "/admin/coupons", "/admin/customers", "/admin/inbox", "/admin/wholesale",
      "/admin/products", "/admin/products/photos", "/admin/products/codes", "/admin/products/labels", "/admin/stock",
    ],
  },
  {
    id: "money",
    href: "/admin/hub/money",
    en: "Money",
    ne: "पैसा र खरिद",
    icon: CashIcon,
    big: ["/admin/transactions?v=in", "/admin/transactions?v=out", "/admin/purchasing"],
    rest: ["/admin/transactions", "/admin/purchasing?view=accounts", "/admin/dues", "/admin/cheques", "/admin/payments", "/admin/costing"],
  },
  {
    id: "factory",
    href: "/admin/hub/factory",
    en: "Factory",
    ne: "कारखाना र ज्याला",
    icon: FactoryIcon,
    big: ["/admin/factory/add-work", "/admin/factory", "/admin/operations/production-accounts/payments"],
    rest: [
      "/admin/factory/photos", "/admin/factory/workers", "/admin/factory/items", "/admin/factory/ledger", "/admin/factory/salary",
      "/admin/operations/production-accounts", "/admin/operations/production-accounts/rates",
      "/admin/operations/production-accounts/lots", "/admin/operations", "/admin/factory/reports", "/admin/factory/worker-portal-qr",
    ],
  },
  { id: "all", href: "/admin/hub/all", en: "All pages", ne: "सबै page", icon: MenuIcon, big: [], rest: [] },
];

/** All pages, in the groups the namuna drew, for the "All pages" screen. */
export const ALL_PAGE_GROUPS: Array<{ en: string; ne: string; pages: string[] }> = [
  { en: "Sales", ne: "बिक्री", pages: ["/admin/pos", "/admin/orders", "/admin/pos?view=reports", "/admin/coupons"] },
  { en: "Products and stock", ne: "सामान र स्टक", pages: ["/admin/products", "/admin/products/photos", "/admin/products/codes", "/admin/products/labels", "/admin/stock"] },
  { en: "Customers", ne: "ग्राहक", pages: ["/admin/customers", "/admin/inbox", "/admin/wholesale", "/admin/reviews", "/admin/feedback", "/admin/messages"] },
  { en: "Money and buying", ne: "पैसा र खरिद", pages: ["/admin/transactions", "/admin/purchasing", "/admin/purchasing?view=accounts", "/admin/dues", "/admin/cheques", "/admin/payments", "/admin/costing"] },
  {
    en: "Factory", ne: "कारखाना",
    pages: ["/admin/factory", "/admin/factory/add-work", "/admin/factory/photos", "/admin/factory/workers", "/admin/factory/items", "/admin/factory/ledger", "/admin/factory/salary", "/admin/factory/reports", "/admin/factory/worker-portal-qr"],
  },
  {
    en: "Wages and production", ne: "ज्याला र उत्पादन",
    pages: ["/admin/operations/production-accounts", "/admin/operations/production-accounts/payments", "/admin/operations/production-accounts/rates", "/admin/operations/production-accounts/lots", "/admin/operations"],
  },
  { en: "Reports", ne: "रिपोर्ट", pages: ["/admin", "/admin/reports", "/admin/analytics", "/admin/reports/channels", "/admin/insights", "/admin/measurement"] },
  {
    en: "Settings and security", ne: "सेटिङ र सुरक्षा",
    pages: ["/admin/settings", "/admin/getting-started", "/admin/settings/whatsapp", "/admin/security-overview", "/admin/security", "/admin/devices", "/admin/change-password", "/admin/activity", "/admin/alerts", "/admin/notifications", "/admin/sms", "/admin/monitoring", "/admin/robots"],
  },
];

/** The page part of an address, for permissions and matching. */
export function hubPath(href: string) {
  return href.split("?")[0];
}

function owns(pathname: string, href: string) {
  const path = hubPath(href);
  return pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
}

/**
 * The menu name a screen sits under, for the side menu's highlight: its own
 * button page, or the one of Sales, Money, Factory that lists it, or Home for
 * the dashboard; anything else is under All pages.
 */
/**
 * Screens reached from a menu name without a button of their own. A
 * customer's account sits under /admin/operations, which is Factory's, but is
 * opened from Credit / Dues and Parties: it belongs to Money (2026-10-29).
 */
const ALSO_UNDER: Partial<Record<HubId, string[]>> = {
  money: ["/admin/operations/ledger"],
};

export function hubForPath(pathname: string): HubId {
  const own = HUBS.find((hub) => pathname === hub.href);
  if (own) return own.id;
  let best: { id: HubId; length: number } | null = null;
  for (const hub of HUBS.filter((h) => h.id === "sales" || h.id === "money" || h.id === "factory")) {
    for (const href of [...hub.big, ...hub.rest, ...(ALSO_UNDER[hub.id] ?? [])]) {
      const length = hubPath(href).length;
      if (owns(pathname, href) && length > (best?.length ?? -1)) best = { id: hub.id, length };
    }
  }
  if (best) return best.id;
  if (pathname === "/admin") return "home";
  return "all";
}

/** The pages a menu name stands for, for adding up what waits behind it. */
export function pagesOfHub(id: HubId): string[] {
  const hub = HUBS.find((h) => h.id === id);
  if (!hub) return [];
  if (id !== "all") return [...hub.big, ...hub.rest].map(hubPath);
  const owned = new Set(
    HUBS.filter((h) => h.id !== "all" && h.id !== "home").flatMap((h) => [...h.big, ...h.rest].map(hubPath)),
  );
  return ALL_PAGE_GROUPS.flatMap((group) => group.pages.map(hubPath)).filter((path) => !owned.has(path));
}

/** The phone's dock (owner, 2026-10-29): the jobs a thumb reaches without a menu. */
export const DOCK = [
  { href: "/admin/pos", en: "Bill", ne: "बिल", icon: CreditCardIcon },
  { href: "/admin/hub/sales", en: "Sales", ne: "बिक्री", icon: ShoppingCartIcon },
  { href: "/admin/stock", en: "Stock", ne: "स्टक", icon: PackageIcon },
  { href: "/admin/factory/add-work", en: "Add work", ne: "काम टिप्ने", icon: UserIcon },
] as const;

/**
 * A button opens a page the role may read — and, for the two that write money,
 * only for a role that may write it (2026-10-29): a Sales login was shown
 * "Money in" and found only the Day Book behind it.
 */
const BUTTON_NEEDS: Record<string, AdminPermission[]> = {
  "/admin/transactions?v=in": ["operations:write"],
  "/admin/transactions?v=out": ["purchasing:write", "wages:write"],
};

export function hubButtonOpen(role: AdminRole, href: string) {
  const needs = BUTTON_NEEDS[href];
  return canAccessAdminPath(role, hubPath(href)) && (!needs || needs.some((need) => canAdmin(role, need)));
}

/**
 * The menu names this role sees: one with no button it may open is left out.
 * A Factory login is kept to the factory's own pages by proxy.ts, so it sees
 * Factory alone.
 */
export function hubsFor(role: AdminRole): Hub[] {
  if (role === "Factory") return HUBS.filter((hub) => hub.id === "factory");
  return HUBS.filter((hub) => {
    if (hub.id === "all" || hub.id === "home") return true;
    return [...hub.big, ...hub.rest].some((href) => hubButtonOpen(role, href));
  });
}
