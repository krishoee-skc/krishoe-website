import type { ComponentType } from "react";
import { HomeIcon, InfoIcon, MessageSquareIcon, ShoppingBagIcon } from "@/components/Icons";

type IconType = ComponentType<{ className?: string }>;

export type NavLink = {
  href: string;
  label: string;
  Icon: IconType;
  // When true, this item shows the Shop category mega-menu on desktop.
  hasMegaMenu?: boolean;
};

// Single source of truth for the primary navigation, shared by the desktop
// nav (PrimaryNav) and the mobile slide-out menu (NavbarControls).
export const navLinks: NavLink[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/shop", label: "Shop", Icon: ShoppingBagIcon, hasMegaMenu: true },
  { href: "/about", label: "Our Story", Icon: InfoIcon },
  { href: "/contact", label: "Contact", Icon: MessageSquareIcon },
];

// A link is active on its exact path; section links (e.g. /shop) also stay
// active on their sub-routes (/shop/party-heels).
export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
