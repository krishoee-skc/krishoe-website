import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-role-permissions";
import { workerInboxCounts } from "@/lib/worker-portal";
import { getHubCounts } from "@/lib/hub-counts";
import { ALL_PAGE_GROUPS, HUBS, hubButtonOpen, type HubId } from "@/app/admin/hubs";
import HubScreen from "@/app/admin/hub/HubScreen";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const hub = HUBS.find((h) => h.id === id);
  return { title: `${hub?.en ?? "Menu"} | KRISHOE Admin` };
}

/**
 * One of the five menu names (owner, 2026-10-29, "kha garau"): the day's work
 * as large buttons, the rest of its pages as small ones; All pages lists every
 * screen. Each person sees only the buttons their role may open.
 */
export default async function HubPage({ params }: Props) {
  const { id } = await params;
  const hub = HUBS.find((h) => h.id === id);
  if (!hub) notFound();

  const session = await getAdminSession();
  const role = getSessionAdminRole(session);
  const may = (href: string) => hubButtonOpen(role, href);

  // What waits behind a button, as the menu already counts it. Never fatal.
  const [inbox, others] = await Promise.all([
    may("/admin/factory/photos")
      ? workerInboxCounts().catch(() => ({ photos: 0, requests: 0 }))
      : Promise.resolve({ photos: 0, requests: 0 }),
    getHubCounts({ orders: may("/admin/orders"), cheques: may("/admin/cheques"), dues: may("/admin/dues") }).catch(() => ({})),
  ]);
  const waiting = inbox.photos + inbox.requests;

  return (
    <HubScreen
      id={hub.id as HubId}
      big={hub.big.filter(may)}
      rest={hub.rest.filter(may)}
      groups={hub.id === "all" ? ALL_PAGE_GROUPS.map((group) => ({ ...group, pages: group.pages.filter(may) })).filter((group) => group.pages.length > 0) : []}
      counts={{ ...others, ...(waiting > 0 ? { "/admin/factory/photos": waiting } : {}) }}
    />
  );
}
