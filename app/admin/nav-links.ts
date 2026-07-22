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
} from "@/components/Icons";

// The admin destinations, shared by the desktop sidebar (AdminNav) and the
// phone nav (AdminMobileNav) so the two never drift apart.
export const adminNavLinks = [
  { href: "/admin", label: "Dashboard", icon: HomeIcon },
  { href: "/admin/search", label: "Search", icon: SearchIcon },
  { href: "/admin/stock", label: "Stock", icon: PackageIcon },
  { href: "/admin/pos", label: "POS Billing", icon: CreditCardIcon },
  { href: "/admin/dues", label: "Dues", icon: CreditCardIcon },
  { href: "/admin/purchasing", label: "Purchasing", icon: PackageIcon },
  { href: "/admin/costing", label: "Costing", icon: CreditCardIcon },
  { href: "/admin/hr", label: "HR", icon: ShieldCheckIcon },
  { href: "/admin/operations", label: "Operations", icon: PackageIcon },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon },
  { href: "/admin/payments", label: "Payments", icon: CreditCardIcon },
  { href: "/admin/notifications", label: "Notifications", icon: BellIcon },
  { href: "/admin/reviews", label: "Reviews", icon: StarIcon },
  { href: "/admin/activity", label: "Activity", icon: ShieldCheckIcon },
  { href: "/admin/settings", label: "Settings", icon: ShieldCheckIcon },
  { href: "/admin/products", label: "Products", icon: PackageIcon },
  { href: "/admin/messages", label: "Messages", icon: MessageSquareIcon },
] as const;
