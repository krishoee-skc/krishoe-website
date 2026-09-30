import { queryPostgres } from "@/lib/postgres/client";
import { notificationTypesStatus } from "@/lib/notification-types-database";
import {
  errorKind,
  isCustomerMailFailure,
  outsideCheckFreshness,
  thingsToDo,
  type ErrorKind,
  type Freshness,
  type WatchItem,
} from "@/lib/shop-watch-rules";

const STORE = "shop watch";

export type ShopWatch = {
  /** The red strip: what needs doing, most urgent first. Empty when nothing does. */
  toDo: WatchItem[];
  notificationKindsMissing: string[];
  mail: {
    /** Mails to the Owner in 30 days, by how they went. */
    ownerSent30d: number;
    ownerFailed30d: number;
    /** Customer mails that failed in 7 days — refused before sending, or not delivered. */
    customerFailed7d: number;
  };
  outsideCheck: { lastAt: string | null; freshness: Freshness };
  /** Every logged problem in 7 days, grouped and sorted by kind. */
  errors7d: Array<{ kind: ErrorKind; message: string; count: number; lastAt: string }>;
  /** How long a save takes on the admin, measured on the server, 7 days. */
  adminSaves: Array<{ what: string; median: number; slowest: number; count: number }>;
};

/**
 * The evening's question: is the outside check still filing? It runs on
 * GitHub, so when it stops nothing on Vercel notices — it stopped on 27 Sept
 * and the screen went on reading 100% (owner, 2026-09-30). A day without a
 * reading fails this job, and a failed evening job reaches the Owner's phone
 * and mail (lib/nightly-jobs.ts).
 */
export async function outsideCheckStillRunning(now = Date.now()) {
  const rows = await queryPostgres<{ last_at: Date | string | null }>(
    STORE,
    "SELECT max(checked_at) AS last_at FROM monitoring_uptime",
  );
  const value = rows[0]?.last_at ?? null;
  const lastAt = value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : null;
  const freshness = outsideCheckFreshness(lastAt, now);
  if (freshness === "stale" || freshness === "never") {
    return {
      deliveryStatus: "sent" as const,
      outcome: "failed" as const,
      summary: lastAt
        ? `No outside check since ${lastAt.slice(0, 16).replace("T", " ")} UTC. Look at GitHub → Actions → Uptime.`
        : "The outside check has never filed a reading. Look at GitHub → Actions → Uptime.",
    };
  }
  return { deliveryStatus: "sent" as const, outcome: "ok" as const, summary: "The outside check is filing." };
}

const OWNER_KINDS = ["order", "contact", "operational-alert"];
const CUSTOMER_KINDS = ["order-confirmation", "review-request"];

/**
 * What the monitoring screen needs to tell the truth (owner, 2026-09-30). Each
 * part is read on its own and falls back to "nothing known", so one failed
 * read never costs the screen the rest.
 */
export async function getShopWatch(): Promise<ShopWatch> {
  const [kinds, mail, customerLogged, outside, errors, saves] = await Promise.all([
    notificationTypesStatus().catch(() => ({ ready: true, missing: [] as string[] })),
    queryPostgres<{ type: string; delivery_status: string; n: number }>(
      STORE,
      `SELECT type, delivery_status, count(*)::int AS n FROM notification_events
        WHERE created_at > now() - interval '30 days' GROUP BY 1, 2`,
    ).catch(() => []),
    queryPostgres<{ message: string; created_at: Date | string }>(
      STORE,
      `SELECT message, created_at FROM monitoring_errors
        WHERE created_at > now() - interval '7 days' AND level = 'error'`,
    ).catch(() => []),
    queryPostgres<{ last_at: Date | string | null }>(
      STORE,
      "SELECT max(checked_at) AS last_at FROM monitoring_uptime",
    ).catch(() => []),
    queryPostgres<{ level: string; message: string; n: number; last_at: Date | string }>(
      STORE,
      `SELECT level, (array_agg(message ORDER BY created_at DESC))[1] AS message,
              count(*)::int AS n, max(created_at) AS last_at
         FROM monitoring_errors
        WHERE created_at > now() - interval '7 days'
        GROUP BY level, COALESCE(fingerprint, message)
        ORDER BY max(created_at) DESC
        LIMIT 60`,
    ).catch(() => []),
    queryPostgres<{ path: string; median: number; slowest: number; n: number }>(
      STORE,
      `SELECT path,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration)::int AS median,
              max(duration)::int AS slowest,
              count(*)::int AS n
         FROM monitoring_performance
        WHERE metric = 'SAVE' AND environment = 'production'
          AND created_at > now() - interval '7 days'
        GROUP BY path ORDER BY path`,
    ).catch(() => []),
  ]);

  const iso = (value: Date | string | null | undefined) =>
    value ? (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) : null;

  let ownerSent30d = 0;
  let ownerFailed30d = 0;
  let customerFailedEvents = 0;
  for (const row of mail) {
    if (OWNER_KINDS.includes(row.type)) {
      if (row.delivery_status === "sent") ownerSent30d += row.n;
      if (row.delivery_status === "failed") ownerFailed30d += row.n;
    }
    if (CUSTOMER_KINDS.includes(row.type) && row.delivery_status === "failed") customerFailedEvents += row.n;
  }
  // A mail refused by the database never becomes a row; it is only in the
  // error log. Both are counted, so neither way of failing goes unseen.
  const customerFailed7d = customerFailedEvents + customerLogged.filter((row) => isCustomerMailFailure(row.message)).length;

  const lastAt = iso(outside[0]?.last_at);
  const freshness = outsideCheckFreshness(lastAt);
  const kindOrder: Record<ErrorKind, number> = { broke: 0, refused: 1, browser: 2 };
  const errors7d = errors
    .map((row) => ({
      kind: errorKind({ level: row.level, message: row.message }),
      message: row.message,
      count: row.n,
      lastAt: iso(row.last_at) ?? "",
    }))
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || b.lastAt.localeCompare(a.lastAt));
  const brokeIn7d = errors7d.filter((row) => row.kind === "broke").reduce((sum, row) => sum + row.count, 0);

  return {
    toDo: thingsToDo({
      notificationKindsMissing: kinds.missing,
      customerMailFailures7d: customerFailed7d,
      outsideCheck: freshness,
      brokeIn7d,
    }),
    notificationKindsMissing: kinds.missing,
    mail: { ownerSent30d, ownerFailed30d, customerFailed7d },
    outsideCheck: { lastAt, freshness },
    errors7d,
    adminSaves: saves.map((row) => ({ what: row.path, median: row.median, slowest: row.slowest, count: row.n })),
  };
}
