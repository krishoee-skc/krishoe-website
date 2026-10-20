import Link from "next/link";
import T from "@/components/T";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccessAdminPath, getSessionAdminRole } from "@/lib/admin-role-permissions";

type StripLink = { href: string; en: string; ne: string };

/**
 * Pages about one thing, one tap apart (owner's sample 7घ ख, 2026-10-14).
 *
 * These pages are not in the daily menu and none of them pointed to its
 * neighbours: from the camera page the login devices were back through
 * Settings. They are not merged — each page stays as it was — a small row like
 * the factory's sits on top of each.
 */
export const pageGroups = {
  security: {
    en: "Security",
    ne: "सुरक्षा",
    links: [
      { href: "/admin/security-overview", en: "Security Center", ne: "एकै ठाउँमा" },
      { href: "/admin/security", en: "Camera", ne: "Camera" },
      { href: "/admin/devices", en: "Login devices", ne: "Devices" },
      { href: "/admin/change-password", en: "Change password", ne: "पासवर्ड" },
    ],
  },
  measure: {
    en: "Shoppers and sales",
    ne: "ग्राहक र बिक्रीको नाप",
    links: [
      { href: "/admin/insights", en: "Reviews and returns", ne: "राय र फिर्ता" },
      { href: "/admin/analytics", en: "Analytics", ne: "बिक्रीको नाप" },
      { href: "/admin/reports/channels", en: "Where shoppers came from", ne: "ग्राहक कहाँबाट" },
      { href: "/admin/measurement", en: "Measurement setup", ne: "मापन सेटअप" },
    ],
  },
  // The shop's money and its customers (owner, 2026-10-20, sample ख):
  // Cheques, Discount codes and Wholesale left the menu, and are here, beside
  // the menu pages they belong with.
  money: {
    en: "Money",
    ne: "पैसा",
    links: [
      { href: "/admin/payments", en: "Payments", ne: "भुक्तानी" },
      { href: "/admin/dues", en: "Credit / Dues", ne: "उधारो" },
      { href: "/admin/cheques", en: "Cheques", ne: "चेक खाता" },
      { href: "/admin/coupons", en: "Discount codes", ne: "छुटको कोड" },
    ],
  },
  customers: {
    en: "Customers",
    ne: "ग्राहक",
    links: [
      { href: "/admin/customers", en: "Customers", ne: "ग्राहक" },
      { href: "/admin/inbox", en: "Customer Voice", ne: "ग्राहकको आवाज" },
      { href: "/admin/wholesale", en: "Wholesale", ne: "थोकको सोधपुछ" },
    ],
  },
  health: {
    en: "The app's health",
    ne: "app को स्वास्थ्य",
    links: [
      { href: "/admin/alerts", en: "Alerts", ne: "चेतावनी" },
      { href: "/admin/activity", en: "Activity", ne: "को ले के गर्‍यो" },
      { href: "/admin/notifications", en: "Notifications", ne: "सूचना" },
      { href: "/admin/sms", en: "SMS", ne: "मोबाइल सन्देश" },
      { href: "/admin/monitoring", en: "Monitoring", ne: "निगरानी" },
      { href: "/admin/robots", en: "Robots", ne: "Robot दरबार" },
    ],
  },
} satisfies Record<string, { en: string; ne: string; links: StripLink[] }>;

export type PageGroup = keyof typeof pageGroups;

export default async function PageGroupStrip({ group, current }: { group: PageGroup; current: string }) {
  const session = await getAdminSession();
  if (!session || session.mustChangePassword) return null;
  const role = getSessionAdminRole(session);
  // Only the pages this person may open. The password page is for a staff
  // sign-in; the owner's own sign-in has no staff record and would be sent
  // back to the login screen.
  const links = pageGroups[group].links.filter((link) =>
    link.href === "/admin/change-password"
      ? Boolean(session.staffId) && role !== "Worker"
      : canAccessAdminPath(role, link.href),
  );
  if (links.length < 2) return null;

  return (
    <nav
      aria-label={pageGroups[group].en}
      className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 print:hidden"
    >
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const active = link.href === current;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-black transition ${
                active
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-black/10 bg-brand-paper text-brand-muted-deep hover:border-brand-green/40 hover:bg-brand-green-wash hover:text-brand-green"
              }`}
            >
              <T en={link.en} ne={link.ne} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
