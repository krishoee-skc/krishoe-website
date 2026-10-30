import type { ReactNode } from "react";

/**
 * The All pages screen in the approved glass namuna (owner, 2026-10-30, "cha
 * garau"): every page its own drawing, and every group its own colour, so a
 * page is found by its look before its name is read. Only this screen uses
 * them; the other menus keep their icons.
 */

/** One colour per group, by the group's English name in ALL_PAGE_GROUPS. */
export const GROUP_COLOURS: Record<string, string> = {
  "Sales": "#12634A",
  "Products and stock": "#A8730C",
  "Customers": "#2F5C8A",
  "Money and buying": "#0E6E6B",
  "Factory": "#9A3A2E",
  "Wages and production": "#A2560F",
  "Reports": "#4B4FA6",
  "Settings and security": "#4A5A63",
};

/** The lines of each page's drawing, on a 24 × 24 grid, by its address. */
const DRAWINGS: Record<string, ReactNode> = {
  "/admin/pos": <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  "/admin/orders": <><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  "/admin/pos?view=reports": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></>,
  "/admin/coupons": <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  "/admin/products": <><path d="M2 17V9.5l4.5-1.5 3 3.5 6 1.5 5.5 2.4V17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" /><path d="M11 12l1.5-2M14 12.6l1.2-1.8" /></>,
  "/admin/products/photos": <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  "/admin/products/codes": <><path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M17 5v14M20 5v14" /></>,
  "/admin/products/labels": <><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4z" /><circle cx="7" cy="7" r="1.5" /></>,
  "/admin/stock": <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  "/admin/customers": <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.4.6 4 2.9 4 6" /></>,
  "/admin/inbox": <><path d="M3 10v4a1 1 0 0 0 1 1h3l9 5V4L7 9H4a1 1 0 0 0-1 1z" /><path d="M20 9a4 4 0 0 1 0 6" /></>,
  "/admin/wholesale": <><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 13v8h14v-8M10 21v-5h4v5" /></>,
  "/admin/reviews": <><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></>,
  "/admin/feedback": <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 8h8M8 12h5" /></>,
  "/admin/messages": <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></>,
  "/admin/transactions": <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  "/admin/purchasing": <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /><path d="M14 9v4M12 11h4" /></>,
  "/admin/purchasing?view=accounts": <><path d="M1 5h13v11H1zM14 9h4l4 4v3h-8" /><circle cx="5.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>,
  "/admin/dues": <><path d="M6 2h12M6 22h12M7 2c0 5 10 6 10 10S7 17 7 22M17 2c0 5-10 6-10 10s10 5 10 10" /></>,
  "/admin/cheques": <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 14h5M15 11l3-3M14 14h4" /></>,
  "/admin/payments": <><path d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  "/admin/costing": <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4" /></>,
  "/admin/factory": <><path d="M2 20V9l6 4V9l6 4V4h4l2 16z" /><path d="M2 20h20" /></>,
  "/admin/factory/add-work": <><path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z" /></>,
  "/admin/factory/photos": <><path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  "/admin/factory/workers": <><path d="M2 18h20v-2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M4 14a8 8 0 0 1 16 0M10 6v5M14 6v5" /></>,
  "/admin/factory/items": <><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></>,
  "/admin/factory/ledger": <><rect x="5" y="2" width="15" height="20" rx="2" /><path d="M2 6h4M2 10h4M2 14h4M2 18h4M10 7h6" /></>,
  "/admin/factory/salary": <><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" /><path d="M3 7h16a2 2 0 0 1 2 2v7h-5a3 3 0 0 1 0-6h5" /></>,
  "/admin/factory/reports": <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v4H9zM9 11h6M9 15h6M9 19h3" /></>,
  "/admin/factory/worker-portal-qr": <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M17 20h4M20 17v3" /></>,
  "/admin/operations/production-accounts": <><circle cx="9" cy="9" r="6" /><path d="M15.5 9.5a6 6 0 1 1-6 6" /><path d="M9 6.5v5M7 8h3" /></>,
  "/admin/operations/production-accounts/payments": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  "/admin/operations/production-accounts/rates": <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  "/admin/operations/production-accounts/lots": <><path d="M12 3v18M5 21h14M3 7h18" /><path d="m6 7-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z" /></>,
  "/admin/operations": <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M6.5 10v3a2 2 0 0 0 2 2H14M14 6.5h3a2 2 0 0 1 2 2V14" /></>,
  "/admin": <><rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></>,
  "/admin/reports": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 18v-3M12 18v-6M16 18v-2" /></>,
  "/admin/analytics": <><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 6-7" /></>,
  "/admin/reports/channels": <><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  "/admin/insights": <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  "/admin/measurement": <><path d="M12 14l4-4" /><path d="M3.3 19a10 10 0 1 1 17.4 0z" /></>,
  "/admin/settings": <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  "/admin/getting-started": <><path d="M5 15c-1.5 1.3-2 4-2 6 2 0 4.7-.5 6-2" /><path d="M9 15l-3-3c1-4 4-9 13-9 0 9-5 12-9 13z" /><circle cx="15" cy="9" r="1.5" /></>,
  "/admin/settings/whatsapp": <><path d="M3 21l1.6-4.8A9 9 0 1 1 7.8 19.4z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" /></>,
  "/admin/security-overview": <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  "/admin/security": <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></>,
  "/admin/devices": <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  "/admin/change-password": <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  "/admin/activity": <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  "/admin/alerts": <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  "/admin/notifications": <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  "/admin/sms": <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
  "/admin/monitoring": <><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5 5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" /><path d="M3.2 12H8l1.5-3 3 6 1.5-3h4.8" /></>,
  "/admin/robots": <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M8 4h8M2 14h2M20 14h2M9 13v2M15 13v2" /></>,
};

export function AllPagesIcon({ href, className }: { href: string; className?: string }) {
  const drawing = DRAWINGS[href];
  if (!drawing) return null;
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {drawing}
    </svg>
  );
}

/** Whether a page has its own drawing here. */
export function hasAllPagesIcon(href: string) {
  return href in DRAWINGS;
}
