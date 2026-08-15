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
      { href: "/admin/factory", label: "Factory Entry", icon: PackageIcon },
      { href: "/admin/operations", label: "Operations", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", icon: PackageIcon },
    ],
  },
  {
    id: "factory-cost",
    title: "लागत र किनमेल",
    workspace: "factory",
    links: [
      { href: "/admin/costing", label: "Costing", icon: CreditCardIcon },
      { href: "/admin/purchasing", label: "Purchasing", icon: PackageIcon },
      { href: "/admin/hr", label: "HR", icon: ShieldCheckIcon },
    ],
  },
  {
    id: "shop-sell",
    title: "बिक्री",
    workspace: "shop",
    links: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon },
      { href: "/admin/pos", label: "POS Billing", icon: CreditCardIcon },
      { href: "/admin/products", label: "Products", icon: PackageIcon },
      { href: "/admin/stock", label: "Stock", icon: PackageIcon },
    ],
  },
  {
    id: "shop-customers",
    title: "ग्राहक",
    workspace: "shop",
    links: [
      { href: "/admin/customers", label: "Customers", icon: UserIcon },
      { href: "/admin/reviews", label: "Reviews", icon: StarIcon },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquareIcon },
      { href: "/admin/insights", label: "Customer Voice", icon: StarIcon },
      { href: "/admin/messages", label: "Messages", icon: MessageSquareIcon },
    ],
  },
  {
    id: "shop-money",
    title: "पैसा",
    workspace: "shop",
    links: [
      { href: "/admin/payments", label: "Payments", icon: CreditCardIcon },
      { href: "/admin/dues", label: "Credit / Dues", icon: CreditCardIcon },
    ],
  },
  {
    id: "shop-messages",
    title: "सन्देश",
    workspace: "shop",
    links: [
      { href: "/admin/notifications", label: "Notifications", icon: BellIcon },
      { href: "/admin/alerts", label: "Alerts", icon: BellIcon },
      { href: "/admin/sms", label: "SMS", icon: MessageSquareIcon },
    ],
  },
  {
    id: "everywhere",
    title: "सबैतिर",
    workspace: "both",
    links: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon },
      { href: "/admin/search", label: "Search", icon: SearchIcon },
      { href: "/admin/settings", label: "Settings", icon: ShieldCheckIcon },
    ],
  },
  {
    id: "records",
    title: "हिसाब र सुरक्षा",
    workspace: "both",
    links: [
      { href: "/admin/analytics", label: "Analytics", icon: StarIcon },
      { href: "/admin/activity", label: "Activity", icon: ShieldCheckIcon },
      { href: "/admin/security", label: "Security / CCTV", icon: ShieldCheckIcon },
      { href: "/admin/monitoring", label: "Monitoring", icon: ShieldCheckIcon },
      { href: "/admin/devices", label: "Login devices", icon: ShieldCheckIcon },
      { href: "/admin/getting-started", label: "Getting Started", icon: HomeIcon },
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
