import {
  HomeIcon,
  PackageIcon,
  ShoppingCartIcon,
  MessageSquareIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  BellIcon,
  StarIcon,
  SearchIcon,
  UserIcon,
  RobotIcon,
} from "@/components/Icons";

/**
 * The admin destinations, shared by the desktop sidebar (AdminNav), the phone
 * nav (AdminMobileNav) and the drawer (AdminDrawer) so the three never drift.
 *
 * Grouped into two workspaces because the business is two: a factory floor
 * where pairs are made and wages counted, and a shop where they are sold. The
 * two need each other rarely and interrupt each other constantly — twenty-eight
 * destinations in one list meant scanning the whole shop to find "Factory
 * Entry", fifty times a day.
 *
 * Stock sits in both on purpose. It is where the factory hands over to the
 * shop, and putting it on one side would mean one side could not see what it
 * had made or what it had left to sell.
 */
export type AdminWorkspace = "factory" | "shop" | "both";

export type AdminNavLink = {
  href: string;
  label: string;
  /** Shown small beneath the English name. The owner reads Nepali; the English
   *  name stays because it is what they have already learned to look for. */
  nepali: string;
  icon: typeof HomeIcon;
};

export type AdminNavGroup = {
  id: string;
  titleEn: string;
  titleNe: string;
  workspace: AdminWorkspace;
  links: AdminNavLink[];
};

export const adminWorkspaces = [
  { id: "factory", labelEn: "Factory", labelNe: "कारखाना", emoji: "🏭" },
  { id: "shop", labelEn: "Shop", labelNe: "पसल", emoji: "🛒" },
] as const;

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "factory-work",
    titleEn: "Work",
    titleNe: "काम",
    workspace: "factory",
    links: [
      { href: "/admin/factory", label: "Factory Entry", nepali: "काम टिप्ने", icon: PackageIcon },
      { href: "/admin/operations", label: "Operations", nepali: "उत्पादन र स्टक", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", nepali: "कति माल छ", icon: PackageIcon },
    ],
  },
  {
    id: "factory-cost",
    titleEn: "Cost and buying",
    titleNe: "लागत र किनमेल",
    workspace: "factory",
    links: [
      { href: "/admin/costing", label: "Costing", nepali: "लागत", icon: CreditCardIcon },
      { href: "/admin/purchasing", label: "Purchasing", nepali: "किनमेल", icon: PackageIcon },
    ],
  },
  {
    id: "shop-sell",
    titleEn: "Selling",
    titleNe: "बिक्री",
    workspace: "shop",
    links: [
      { href: "/admin/orders", label: "Orders", nepali: "अर्डर", icon: ShoppingCartIcon },
      { href: "/admin/pos", label: "POS Billing", nepali: "बिल काट्ने", icon: CreditCardIcon },
      // Photos is reached from the Products screen, which is where a photo is
      // actually missing from and where the owner is already standing when
      // they notice.
      { href: "/admin/products", label: "Products", nepali: "सामान · फोटो · मूल्य", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", nepali: "कति माल छ", icon: PackageIcon },
    ],
  },
  {
    id: "shop-customers",
    titleEn: "Customers",
    titleNe: "ग्राहक",
    workspace: "shop",
    links: [
      { href: "/admin/customers", label: "Customers", nepali: "ग्राहक", icon: UserIcon },
      // Reviews, Feedback, Customer Voice and Messages were four entries over
      // four different stores — one of them a table that had never been
      // created. Answering a customer meant opening all four and hoping none
      // had been missed. They are one inbox now.
      { href: "/admin/inbox", label: "Customer Voice", nepali: "ग्राहकको आवाज", icon: MessageSquareIcon },
      { href: "/admin/wholesale", label: "Wholesale", nepali: "थोकको सोधपुछ", icon: UserIcon },
    ],
  },
  {
    id: "shop-money",
    titleEn: "Money",
    titleNe: "पैसा",
    workspace: "shop",
    links: [
      { href: "/admin/payments", label: "Payments", nepali: "भुक्तानी", icon: CreditCardIcon },
      { href: "/admin/dues", label: "Credit / Dues", nepali: "उधारो", icon: CreditCardIcon },
      { href: "/admin/coupons", label: "Discount codes", nepali: "छुटको कोड", icon: CreditCardIcon },
    ],
  },
  {
    id: "everywhere",
    titleEn: "Everywhere",
    titleNe: "सबैतिर",
    workspace: "both",
    links: [
      { href: "/admin", label: "Dashboard", nepali: "मुख्य पाना", icon: HomeIcon },
      { href: "/admin/search", label: "Search", nepali: "खोज्ने", icon: SearchIcon },
      // The control room for the eight jobs that run on their own. Their status
      // used to be scattered across four screens inside Settings; this gathers
      // it into one place and links back out to each one's detail.
      { href: "/admin/robots", label: "Robots", nepali: "Robot दरबार · स्वचालन", icon: RobotIcon },
      // Who tried to sign in — successes, failures and blocked attempts in one
      // place, so a run of attempts on an account is noticed rather than buried.
      { href: "/admin/security-overview", label: "Security", nepali: "सुरक्षा · कसले पस्न खोज्यो", icon: ShieldCheckIcon },
      // One door to all eleven ways the shop can look at itself. Six of them
      // were hard to find: four were in no menu at all, and monitoring and the
      // activity log lived only inside Settings — which is the right place for
      // a screen opened once on the first afternoon, and the wrong place for a
      // report meant to be read every week.
      { href: "/admin/reports", label: "Report", nepali: "हिसाब", icon: StarIcon },
      { href: "/admin/settings", label: "Settings", nepali: "सेटिङ · सेटअप", icon: ShieldCheckIcon },
    ],
  },
];

/**
 * The screens that are opened once and then not again.
 *
 * These sat in the main menu beside Factory Entry and Orders, which are opened
 * fifty times a day. Ten of the twenty-five a shopkeeper saw were things like
 * "Getting Started" and "Login devices" — set up on the first afternoon and
 * never touched since — and the daily work had to be found among them.
 *
 * Nothing is deleted or made unreachable: every one is listed on the Settings
 * screen, and Search finds them by name. They are simply not in the way.
 */
export const adminSetupGroups: Array<{
  titleEn: string;
  titleNe: string;
  links: AdminNavLink[];
}> = [
  {
    titleEn: "Getting started",
    titleNe: "सुरु गर्ने",
    links: [
      { href: "/admin/getting-started", label: "Getting Started", nepali: "सुरु गर्ने", icon: HomeIcon },
      { href: "/admin/measurement", label: "Measurement setup", nepali: "मापन सेटअप", icon: StarIcon },
    ],
  },
  {
    titleEn: "Security",
    titleNe: "सुरक्षा",
    links: [
      { href: "/admin/devices", label: "Login devices", nepali: "कुन फोन/computer", icon: ShieldCheckIcon },
      { href: "/admin/security", label: "Security / CCTV", nepali: "सुरक्षा", icon: ShieldCheckIcon },
      { href: "/admin/activity", label: "Activity", nepali: "को ले के गर्‍यो", icon: ShieldCheckIcon },
    ],
  },
  {
    titleEn: "System",
    titleNe: "प्रणाली",
    links: [
      { href: "/admin/monitoring", label: "Monitoring", nepali: "निगरानी", icon: ShieldCheckIcon },
      { href: "/admin/notifications", label: "Notifications", nepali: "सूचना", icon: BellIcon },
      { href: "/admin/alerts", label: "Alerts", nepali: "चेतावनी", icon: BellIcon },
      { href: "/admin/sms", label: "SMS", nepali: "मोबाइल सन्देश", icon: MessageSquareIcon },
    ],
  },
];

/** Every setup destination, flat. */
export const adminSetupLinks = adminSetupGroups.flatMap((group) => group.links);

/**
 * Every destination once, in group order.
 *
 * Stock is listed under both workspaces, so this deduplicates — anything
 * counting or filtering destinations wants each one once.
 */
export const adminNavLinks = adminNavGroups
  .flatMap((group) => group.links)
  .filter(
    (link, index, all) => all.findIndex((other) => other.href === link.href) === index,
  );

/**
 * Which workspace a path belongs to.
 *
 * Longest match wins, so /admin/factory beats /admin. Anything shared — or
 * unknown — returns "both", which leaves whichever workspace the reader had
 * open alone rather than throwing them to the other side mid-task.
 */
export function workspaceForPath(pathname: string): AdminWorkspace {
  let bestLength = -1;
  let workspaces = new Set<AdminWorkspace>();

  for (const group of adminNavGroups) {
    for (const link of group.links) {
      const matches = pathname === link.href || pathname.startsWith(`${link.href}/`);
      if (!matches) continue;

      if (link.href.length > bestLength) {
        bestLength = link.href.length;
        workspaces = new Set([group.workspace]);
      } else if (link.href.length === bestLength) {
        workspaces.add(group.workspace);
      }
    }
  }

  // Stock is listed on both sides, so it matches twice. A page that belongs to
  // both belongs to neither exclusively — return "both" and leave whichever
  // side the reader had open alone.
  if (workspaces.size !== 1) return "both";
  return [...workspaces][0];
}
