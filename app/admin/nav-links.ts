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
  title: string;
  workspace: AdminWorkspace;
  links: AdminNavLink[];
};

export const adminWorkspaces = [
  { id: "factory", label: "कारखाना", english: "Factory", emoji: "🏭" },
  { id: "shop", label: "पसल", english: "Shop", emoji: "🛒" },
] as const;

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "factory-work",
    title: "काम",
    workspace: "factory",
    links: [
      { href: "/admin/factory", label: "Factory Entry", nepali: "काम टिप्ने", icon: PackageIcon },
      { href: "/admin/operations", label: "Operations", nepali: "उत्पादन र स्टक", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", nepali: "कति माल छ", icon: PackageIcon },
    ],
  },
  {
    id: "factory-cost",
    title: "लागत र किनमेल",
    workspace: "factory",
    links: [
      { href: "/admin/costing", label: "Costing", nepali: "लागत", icon: CreditCardIcon },
      { href: "/admin/purchasing", label: "Purchasing", nepali: "किनमेल", icon: PackageIcon },
      { href: "/admin/hr", label: "HR", nepali: "कर्मचारी", icon: ShieldCheckIcon },
    ],
  },
  {
    id: "shop-sell",
    title: "बिक्री",
    workspace: "shop",
    links: [
      { href: "/admin/orders", label: "Orders", nepali: "अर्डर", icon: ShoppingCartIcon },
      { href: "/admin/pos", label: "POS Billing", nepali: "बिल काट्ने", icon: CreditCardIcon },
      { href: "/admin/products", label: "Products", nepali: "सामान र मूल्य", icon: PackageIcon },
      { href: "/admin/products/photos", label: "Photos", nepali: "फोटो हाल्ने", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", nepali: "कति माल छ", icon: PackageIcon },
    ],
  },
  {
    id: "shop-customers",
    title: "ग्राहक",
    workspace: "shop",
    links: [
      { href: "/admin/customers", label: "Customers", nepali: "ग्राहक", icon: UserIcon },
      { href: "/admin/wholesale", label: "Wholesale", nepali: "थोकको सोधपुछ", icon: UserIcon },
      { href: "/admin/reviews", label: "Reviews", nepali: "ग्राहकको राय", icon: StarIcon },
      { href: "/admin/feedback", label: "Feedback", nepali: "गुनासो", icon: MessageSquareIcon },
      { href: "/admin/insights", label: "Customer Voice", nepali: "ग्राहकको आवाज", icon: StarIcon },
      { href: "/admin/messages", label: "Messages", nepali: "सन्देश", icon: MessageSquareIcon },
    ],
  },
  {
    id: "shop-money",
    title: "पैसा",
    workspace: "shop",
    links: [
      { href: "/admin/payments", label: "Payments", nepali: "भुक्तानी", icon: CreditCardIcon },
      { href: "/admin/dues", label: "Credit / Dues", nepali: "उधारो", icon: CreditCardIcon },
      { href: "/admin/coupons", label: "Discount codes", nepali: "छुटको कोड", icon: CreditCardIcon },
    ],
  },
  {
    id: "shop-messages",
    title: "सन्देश",
    workspace: "shop",
    links: [
      { href: "/admin/notifications", label: "Notifications", nepali: "सूचना", icon: BellIcon },
      { href: "/admin/alerts", label: "Alerts", nepali: "चेतावनी", icon: BellIcon },
      { href: "/admin/sms", label: "SMS", nepali: "मोबाइल सन्देश", icon: MessageSquareIcon },
    ],
  },
  {
    id: "everywhere",
    title: "सबैतिर",
    workspace: "both",
    links: [
      { href: "/admin", label: "Dashboard", nepali: "मुख्य पाना", icon: HomeIcon },
      { href: "/admin/search", label: "Search", nepali: "खोज्ने", icon: SearchIcon },
      { href: "/admin/open-on-phone", label: "Open on phone", nepali: "फोनमा खोल्ने", icon: SearchIcon },
      { href: "/admin/settings", label: "Settings", nepali: "सेटिङ", icon: ShieldCheckIcon },
    ],
  },
  {
    id: "records",
    title: "हिसाब र सुरक्षा",
    workspace: "both",
    links: [
      { href: "/admin/analytics", label: "Analytics", nepali: "हिसाब र नाफा", icon: StarIcon },
      { href: "/admin/activity", label: "Activity", nepali: "को ले के गर्‍यो", icon: ShieldCheckIcon },
      { href: "/admin/security", label: "Security / CCTV", nepali: "सुरक्षा", icon: ShieldCheckIcon },
      { href: "/admin/monitoring", label: "Monitoring", nepali: "निगरानी", icon: ShieldCheckIcon },
      { href: "/admin/devices", label: "Login devices", nepali: "कुन फोन/computer", icon: ShieldCheckIcon },
      { href: "/admin/getting-started", label: "Getting Started", nepali: "सुरु गर्ने", icon: HomeIcon },
    ],
  },
];

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
