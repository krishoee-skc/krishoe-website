import { canAccessAdminPath, canAdmin, type AdminRole } from "@/lib/admin-role-permissions";
import { getVoiceCounts } from "@/lib/customer-voice";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";
import { toBikramSambatNepali } from "@/lib/bikram-sambat";
import type { SelfCheck } from "@/lib/shop-self-check";
import { getOrders } from "@/lib/submissions";

/**
 * What waits, in one list under the 🔔 (owner, 2026-10-14, the menu sample).
 *
 * The admin already knew all of it — the self-checks, the workers' photos and
 * questions, the customers waiting for an answer — but said it only as small
 * badges inside the menu, and not at all for an order left half done: one sat
 * at "Contacted" from 27 September with nothing anywhere saying so. Each line
 * says what it is and opens the screen where it is put right; a reader sees
 * only what their role may open.
 */
export type BellItem = {
  id: string;
  tone: "critical" | "warning" | "info";
  en: string;
  ne: string;
  detailEn: string;
  detailNe: string;
  href: string;
  /** How many, when it is a count; 0 for a single check. */
  count: number;
};

type OpenOrders = { count: number; oldestId: string; oldestAt: string };

/** Orders not yet billed or closed: New, or Contacted and still open. */
async function openOrders(): Promise<OpenOrders> {
  return runWithDataBackend({
    storeName: "orders",
    localJson: async () => {
      const open = (await getOrders())
        .filter((order) => order.status === "New" || order.status === "Contacted")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      return { count: open.length, oldestId: open[0]?.id ?? "", oldestAt: open[0]?.createdAt ?? "" };
    },
    postgres: async () => {
      const rows = await queryPostgres<{ n: number; oldest_id: string | null; oldest_at: string | Date | null }>(
        "orders",
        `SELECT count(*)::int AS n,
                (array_agg(id ORDER BY created_at ASC))[1] AS oldest_id,
                min(created_at) AS oldest_at
           FROM orders
          WHERE status IN ('New', 'Contacted')`,
      );
      const row = rows[0];
      const at = row?.oldest_at;
      return {
        count: row?.n ?? 0,
        oldestId: row?.oldest_id ?? "",
        oldestAt: at ? (at instanceof Date ? at.toISOString() : String(at)) : "",
      };
    },
  });
}

/** "27 Sep" — the day, in Nepal's time. */
function englishDay(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** An order number short enough for one line: KRS-…4YZ2. */
function shortOrder(id: string) {
  return id.length > 12 ? `${id.split("-")[0]}-…${id.slice(-4)}` : id;
}

export async function getAdminBell(input: {
  role: AdminRole;
  checks: Array<Pick<SelfCheck, "id" | "severity" | "title" | "titleNe" | "detail" | "detailNe" | "href">>;
  inbox: { photos: number; requests: number };
}): Promise<BellItem[]> {
  const { role, checks, inbox } = input;
  const may = (href: string) => canAccessAdminPath(role, href);
  const items: BellItem[] = [];

  const [orders, voice] = await Promise.all([
    may("/admin/orders") ? openOrders().catch(() => null) : Promise.resolve(null),
    // The inbox page asks feedback:read itself; its path is in no prefix list.
    canAdmin(role, "feedback:read") ? getVoiceCounts().then((counts) => counts.waiting).catch(() => 0) : Promise.resolve(0),
  ]);

  if (orders && orders.count > 0) {
    const since = orders.oldestAt
      ? { en: `, since ${englishDay(orders.oldestAt)}`, ne: `, ${toBikramSambatNepali(orders.oldestAt)} देखि` }
      : { en: "", ne: "" };
    items.push({
      id: "open-orders",
      tone: "critical",
      en: orders.count === 1 ? "1 order not billed yet" : `${orders.count} orders not billed yet`,
      ne: `${orders.count} अर्डरको बिल काट्न बाँकी`,
      detailEn: `Oldest ${shortOrder(orders.oldestId)}${since.en}`,
      detailNe: `सबैभन्दा पुरानो ${shortOrder(orders.oldestId)}${since.ne}`,
      href: "/admin/orders",
      count: orders.count,
    });
  }

  if (may("/admin/factory/photos") && inbox.photos > 0) {
    items.push({
      id: "worker-photos",
      tone: "warning",
      en: `${inbox.photos} from workers to check`,
      ne: `कामदारले पठाएको ${inbox.photos} वटा जाँच्न बाँकी`,
      detailEn: "Photos and written work wait for your ✓",
      detailNe: "फोटो र लेखेको काम तपाईंको ✓ पर्खिरहेको",
      href: "/admin/factory/photos",
      count: inbox.photos,
    });
  }

  if (may("/admin/factory/photos") && inbox.requests > 0) {
    items.push({
      id: "worker-requests",
      tone: "warning",
      en: `${inbox.requests} worker question${inbox.requests === 1 ? "" : "s"} to answer`,
      ne: `कामदारको ${inbox.requests} प्रश्न वा पेस्की माग`,
      detailEn: "A sum that does not match, or an advance",
      detailNe: "हिसाब मिलेन वा पेस्की",
      href: "/admin/factory/photos",
      count: inbox.requests,
    });
  }

  if (voice > 0) {
    items.push({
      id: "customer-voice",
      tone: "warning",
      en: `${voice} customer message${voice === 1 ? "" : "s"} to answer`,
      ne: `ग्राहकको ${voice} कुराको जवाफ बाँकी`,
      detailEn: "Reviews, questions and complaints",
      detailNe: "राय, प्रश्न र गुनासो",
      href: "/admin/inbox",
      count: voice,
    });
  }

  for (const check of checks) {
    if (!check.href.startsWith("/admin") || !may(check.href)) continue;
    items.push({
      id: `check-${check.id}`,
      tone: check.severity,
      en: check.title,
      ne: check.titleNe,
      detailEn: check.detail,
      detailNe: check.detailNe,
      href: check.href,
      count: 0,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return items.sort((left, right) => order[left.tone] - order[right.tone]);
}
