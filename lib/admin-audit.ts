import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { getAdminSession } from "@/lib/admin-auth";
import { getConfiguredAdminRole } from "@/lib/admin-permissions";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export type AdminAuditActor = {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  actorBranchId?: string;
};

export type AdminAuditEvent = {
  id: string;
  createdAt: string;
  action: string;
  detail: string;
  status: "success" | "warning";
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actorBranchId: string;
};

export const adminAuditCategories = [
  "Security",
  "Operations",
  "Orders",
  "Products",
  "Reviews",
  "Messages",
  "Settings",
  "Backup",
  "System",
] as const;

export type AdminAuditCategory = (typeof adminAuditCategories)[number];
export type AdminAuditStatusFilter = "all" | AdminAuditEvent["status"];
export type AdminAuditFilters = {
  q: string;
  category: AdminAuditCategory | "all";
  status: AdminAuditStatusFilter;
  actor: string;
  from: string;
  to: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const auditPath = path.join(dataDirectory, "admin-audit.json");
const maxAuditEvents = 500;

type AdminAuditEventRow = {
  id: string;
  created_at: Date | string;
  action: string;
  detail: string;
  status: AdminAuditEvent["status"];
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  actor_branch_id: string | null;
};

function createAuditId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `KRS-AUD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function eventFromRow(row: AdminAuditEventRow): AdminAuditEvent {
  return {
    id: row.id,
    createdAt: isoDate(row.created_at),
    action: row.action,
    detail: row.detail,
    status: row.status,
    actorId: row.actor_id ?? "",
    actorName: row.actor_name ?? "",
    actorEmail: row.actor_email ?? "",
    actorRole: row.actor_role ?? "",
    actorBranchId: row.actor_branch_id ?? "",
  };
}

function normalizeEvent(value: unknown): AdminAuditEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Partial<AdminAuditEvent>;

  if (!event.id || !event.createdAt || !event.action || !event.detail) {
    return null;
  }

  return {
    id: event.id,
    createdAt: event.createdAt,
    action: event.action,
    detail: event.detail,
    status: event.status === "warning" ? "warning" : "success",
    actorId: event.actorId ?? "",
    actorName: event.actorName ?? "",
    actorEmail: event.actorEmail ?? "",
    actorRole: event.actorRole ?? "",
    actorBranchId: event.actorBranchId ?? "",
  };
}

function isAuditEvent(event: AdminAuditEvent | null): event is AdminAuditEvent {
  return event !== null;
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function cleanSearchParam(value: string | string[] | undefined) {
  return firstSearchParam(value).trim();
}

function isAdminAuditCategory(value: string): value is AdminAuditCategory {
  return adminAuditCategories.includes(value as AdminAuditCategory);
}

function parseFilterDate(value: string, boundary: "start" | "end") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanDateSearchParam(value: string | string[] | undefined) {
  const date = cleanSearchParam(value);
  return parseFilterDate(date, "start") ? date : "";
}

function eventText(event: AdminAuditEvent) {
  return [
    event.id,
    event.action,
    event.detail,
    event.actorId,
    event.actorName,
    event.actorEmail,
    event.actorRole,
    event.actorBranchId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function actorText(event: AdminAuditEvent) {
  return [event.actorId, event.actorName, event.actorEmail, event.actorRole, event.actorBranchId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getAdminAuditCategory(action: string): AdminAuditCategory {
  if (action.startsWith("operations_")) return "Operations";
  if (action.startsWith("order_")) return "Orders";
  if (action.startsWith("product_")) return "Products";
  if (action.startsWith("review_")) return "Reviews";
  if (action.startsWith("message_")) return "Messages";
  if (action.startsWith("settings_")) return "Settings";
  if (action.includes("backup")) return "Backup";
  if (action.startsWith("activity_")) return "Security";
  if (action.includes("login") || action === "logout") return "Security";
  return "System";
}

export function normalizeAdminAuditFilters(
  input: Partial<Record<string, string | string[] | undefined>>,
): AdminAuditFilters {
  const category = cleanSearchParam(input.category);
  const status = cleanSearchParam(input.status);

  return {
    q: cleanSearchParam(input.q).slice(0, 120),
    category: isAdminAuditCategory(category) ? category : "all",
    status: status === "success" || status === "warning" ? status : "all",
    actor: cleanSearchParam(input.actor).slice(0, 120),
    from: cleanDateSearchParam(input.from),
    to: cleanDateSearchParam(input.to),
  };
}

export function hasAdminAuditFilters(filters: AdminAuditFilters) {
  return Boolean(
    filters.q ||
      filters.category !== "all" ||
      filters.status !== "all" ||
      filters.actor ||
      filters.from ||
      filters.to,
  );
}

export function adminAuditFiltersToSearchParams(filters: AdminAuditFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return params;
}

export function filterAdminAuditEvents(events: AdminAuditEvent[], filters: AdminAuditFilters) {
  const query = filters.q.toLowerCase();
  const actor = filters.actor.toLowerCase();
  const fromDate = parseFilterDate(filters.from, "start");
  const toDate = parseFilterDate(filters.to, "end");

  return events.filter((event) => {
    const createdAt = new Date(event.createdAt);

    if (filters.category !== "all" && getAdminAuditCategory(event.action) !== filters.category) {
      return false;
    }

    if (filters.status !== "all" && event.status !== filters.status) {
      return false;
    }

    if (query && !eventText(event).includes(query)) {
      return false;
    }

    if (actor && !actorText(event).includes(actor)) {
      return false;
    }

    if (fromDate && createdAt < fromDate) {
      return false;
    }

    if (toDate && createdAt > toDate) {
      return false;
    }

    return true;
  });
}

async function readAuditEventsFromLocalJson() {
  try {
    const content = await readFile(auditPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? parsed.map(normalizeEvent).filter(isAuditEvent) : [];
  } catch {
    return [];
  }
}

async function readAuditEventsFromPostgres(limit = maxAuditEvents) {
  const rows = await queryPostgres<AdminAuditEventRow>(
    "admin audit events",
    `
      SELECT id, created_at, action, detail, status
        , actor_id, actor_name, actor_email, actor_role, actor_branch_id
      FROM admin_audit_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows.map(eventFromRow);
}

async function writeAuditEvents(events: AdminAuditEvent[]) {
  await writeFileAtomic(auditPath, `${JSON.stringify(events.slice(0, maxAuditEvents), null, 2)}\n`);
}

async function appendAdminAuditEventToPostgres(event: AdminAuditEvent) {
  const rows = await queryPostgres<AdminAuditEventRow>(
    "admin audit events",
    `
      INSERT INTO admin_audit_events (
        id, created_at, action, detail, status,
        actor_id, actor_name, actor_email, actor_role, actor_branch_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at, action, detail, status,
        actor_id, actor_name, actor_email, actor_role, actor_branch_id
    `,
    [
      event.id,
      new Date(event.createdAt),
      event.action,
      event.detail,
      event.status,
      event.actorId,
      event.actorName,
      event.actorEmail,
      event.actorRole,
      event.actorBranchId,
    ],
  );

  await queryPostgres<{ id: string }>(
    "admin audit events",
    `
      DELETE FROM admin_audit_events
      WHERE id NOT IN (
        SELECT id
        FROM admin_audit_events
        ORDER BY created_at DESC
        LIMIT $1
      )
      RETURNING id
    `,
    [maxAuditEvents],
  );

  return eventFromRow(rows[0]);
}

function normalizeActor(actor?: AdminAuditActor | null): Required<AdminAuditActor> {
  return {
    actorId: actor?.actorId?.trim() ?? "",
    actorName: actor?.actorName?.trim() ?? "",
    actorEmail: actor?.actorEmail?.trim() ?? "",
    actorRole: actor?.actorRole?.trim() ?? "",
    actorBranchId: actor?.actorBranchId?.trim() ?? "",
  };
}

async function getCurrentAuditActor() {
  try {
    const session = await getAdminSession();

    if (!session) {
      return normalizeActor();
    }

    return normalizeActor({
      actorId: session.staffId,
      actorName: session.name ?? "Bootstrap admin",
      actorEmail: session.email,
      actorRole: session.role ?? getConfiguredAdminRole(),
      actorBranchId: session.branchId,
    });
  } catch {
    return normalizeActor();
  }
}

export async function appendAdminAuditEvent(
  action: string,
  detail: string,
  status: AdminAuditEvent["status"] = "success",
  actor?: AdminAuditActor | null,
) {
  const resolvedActor = actor ? normalizeActor(actor) : await getCurrentAuditActor();
  const event: AdminAuditEvent = {
    id: createAuditId(),
    createdAt: new Date().toISOString(),
    action,
    detail,
    status,
    ...resolvedActor,
  };

  return runWithDataBackend({
    storeName: "admin audit events",
    localJson: async () => {
      const events = await readAuditEventsFromLocalJson();
      await writeAuditEvents([event, ...events]);
      return event;
    },
    postgres: () => appendAdminAuditEventToPostgres(event),
  });
}

export async function getAdminAuditEvents(limit = 20) {
  return runWithDataBackend({
    storeName: "admin audit events",
    localJson: async () => {
      const events = await readAuditEventsFromLocalJson();
      return events.slice(0, limit);
    },
    postgres: () => readAuditEventsFromPostgres(limit),
  });
}
