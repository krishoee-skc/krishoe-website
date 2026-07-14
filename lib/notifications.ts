import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { getOperationsSnapshot } from "@/lib/operations";
import { getPaymentReconciliation } from "@/lib/payment-reconciliation";
import { getPosSnapshot } from "@/lib/pos";
import { queryPostgres } from "@/lib/postgres/client";
import { getProducts } from "@/lib/product-store";
import { getPurchasingSnapshot } from "@/lib/purchasing";
import type { ContactSubmission, OrderSubmission } from "@/lib/submissions";

export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type NotificationEventType = "order" | "contact" | "password-reset" | "operational-alert";
export type OperationalAlertSeverity = "critical" | "warning" | "info";
export type OperationalAlertCategory =
  | "collection"
  | "supplier"
  | "stock"
  | "payment"
  | "posting"
  | "catalog";

export type PasswordResetNotificationPayload = {
  email: string;
  resetUrl: string;
  expiresAt: string;
  requestedAt: string;
};

type OperationalAlertNotificationPayload = {
  alertId: string;
  category: OperationalAlertCategory;
  severity: OperationalAlertSeverity;
  detail: string;
  action: string;
  href: string;
  amount?: number;
};
type NotificationPayload =
  | OrderSubmission
  | ContactSubmission
  | PasswordResetNotificationPayload
  | OperationalAlertNotificationPayload;

export type NotificationEvent = {
  id: string;
  createdAt: string;
  type: NotificationEventType;
  title: string;
  payload: NotificationPayload;
  deliveryStatus: NotificationDeliveryStatus;
  deliveryAttempts: number;
  deliveredAt?: string;
  lastDeliveryError: string;
  lastDeliveryChannel: string;
};

export type NotificationDeliveryResult = {
  id: string;
  ok: boolean;
  status: NotificationDeliveryStatus;
  attemptedChannels: string[];
  successfulChannels: string[];
  error: string;
};

export type OperationalAlert = {
  id: string;
  category: OperationalAlertCategory;
  severity: OperationalAlertSeverity;
  title: string;
  detail: string;
  action: string;
  href: string;
  amount?: number;
};

export type OperationalAlertCenter = {
  alerts: OperationalAlert[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
};

type NotificationChannel = {
  id: "webhook" | "email-http" | "sms-http";
  label: string;
  url: string;
  token: string;
  target?: string;
};

type NotificationChannelStatus = {
  id: NotificationChannel["id"];
  label: string;
  configured: boolean;
  detail: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const notificationsPath = path.join(dataDirectory, "notification-events.json");
const maxNotificationEvents = 300;

type NotificationEventRow = {
  id: string;
  created_at: Date | string;
  type: NotificationEventType;
  title: string;
  payload: unknown;
  delivery_status: NotificationDeliveryStatus;
  delivery_attempts: number;
  delivered_at: Date | string | null;
  last_delivery_error: string | null;
  last_delivery_channel: string | null;
};

function createId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `KRS-NOT-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeDeliveryStatus(value: unknown): NotificationDeliveryStatus {
  return value === "sent" || value === "failed" || value === "skipped" ? value : "pending";
}

function normalizeEventType(value: unknown): NotificationEventType {
  if (value === "contact" || value === "password-reset" || value === "operational-alert") {
    return value;
  }

  return "order";
}

function normalizeEvent(event: Partial<NotificationEvent> & Pick<NotificationEvent, "id" | "createdAt" | "type" | "title" | "payload">): NotificationEvent {
  return {
    id: event.id,
    createdAt: event.createdAt,
    type: normalizeEventType(event.type),
    title: event.title,
    payload: event.payload,
    deliveryStatus: normalizeDeliveryStatus(event.deliveryStatus),
    deliveryAttempts: Math.max(0, Number(event.deliveryAttempts) || 0),
    deliveredAt: optionalIsoDate(event.deliveredAt),
    lastDeliveryError: event.lastDeliveryError ?? "",
    lastDeliveryChannel: event.lastDeliveryChannel ?? "",
  };
}

function eventFromRow(row: NotificationEventRow): NotificationEvent {
  return normalizeEvent({
    id: row.id,
    createdAt: isoDate(row.created_at),
    type: row.type,
    title: row.title,
    payload: row.payload as NotificationPayload,
    deliveryStatus: row.delivery_status,
    deliveryAttempts: Number(row.delivery_attempts) || 0,
    deliveredAt: optionalIsoDate(row.delivered_at),
    lastDeliveryError: row.last_delivery_error ?? "",
    lastDeliveryChannel: row.last_delivery_channel ?? "",
  });
}

function textSummary(event: NotificationEvent) {
  if (event.type === "order") {
    const order = event.payload as OrderSubmission;

    return [
      event.title,
      `Customer: ${order.name}`,
      `Phone: ${order.phone}`,
      order.email ? `Email: ${order.email}` : "",
      `Total: ${order.total || "-"}`,
      `Payment: ${order.payment || order.paymentProvider}`,
      `Delivery: ${order.delivery || "-"}`,
      `Address: ${order.address}`,
      `Order: ${order.order}`,
    ].filter(Boolean).join("\n");
  }

  if (event.type === "password-reset") {
    const reset = event.payload as PasswordResetNotificationPayload;

    return [
      event.title,
      `Email: ${reset.email}`,
      `Reset link: ${reset.resetUrl}`,
      `Expires: ${reset.expiresAt}`,
    ].join("\n");
  }

  if (event.type === "operational-alert") {
    const alert = event.payload as OperationalAlertNotificationPayload;

    return [
      event.title,
      `Severity: ${alert.severity}`,
      `Category: ${alert.category}`,
      `Detail: ${alert.detail}`,
      `Action: ${alert.action}`,
      `Open: ${alert.href}`,
    ].join("\n");
  }

  const message = event.payload as ContactSubmission;

  return [
    event.title,
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Message: ${message.message}`,
  ].join("\n");
}

function deliveryTimeoutMs() {
  const configured = Number(envValue("NOTIFICATION_DELIVERY_TIMEOUT_MS"));
  return Number.isFinite(configured) && configured > 0 ? configured : 6000;
}

function notificationTarget(channel: NotificationChannel, event: NotificationEvent) {
  if (event.type === "password-reset" && channel.id === "email-http") {
    return (event.payload as PasswordResetNotificationPayload).email;
  }

  return channel.target;
}

function getConfiguredChannels(event?: NotificationEvent): NotificationChannel[] {
  const webhookUrl = envValue("NOTIFICATION_WEBHOOK_URL");
  const emailUrl = envValue("EMAIL_PROVIDER_URL");
  const smsUrl = envValue("SMS_PROVIDER_URL");
  const emailTarget =
    event?.type === "password-reset"
      ? (event.payload as PasswordResetNotificationPayload).email
      : envValue("ADMIN_NOTIFICATION_EMAIL");
  const channels: NotificationChannel[] = [];

  if (event?.type === "password-reset") {
    return emailUrl && emailTarget
      ? [
          {
            id: "email-http",
            label: "Email HTTP",
            url: emailUrl,
            token: envValue("EMAIL_PROVIDER_TOKEN"),
            target: emailTarget,
          },
        ]
      : [];
  }

  if (webhookUrl) {
    channels.push({
      id: "webhook",
      label: "Webhook",
      url: webhookUrl,
      token: envValue("NOTIFICATION_WEBHOOK_TOKEN"),
    });
  }

  if (emailUrl && emailTarget) {
    channels.push({
      id: "email-http",
      label: "Email HTTP",
      url: emailUrl,
      token: envValue("EMAIL_PROVIDER_TOKEN"),
      target: emailTarget,
    });
  }

  if (smsUrl && envValue("ADMIN_NOTIFICATION_PHONE")) {
    channels.push({
      id: "sms-http",
      label: "SMS HTTP",
      url: smsUrl,
      token: envValue("SMS_PROVIDER_TOKEN"),
      target: envValue("ADMIN_NOTIFICATION_PHONE"),
    });
  }

  return channels;
}

export function getNotificationDeliveryConfig() {
  const statuses: NotificationChannelStatus[] = [
    {
      id: "webhook",
      label: "Webhook",
      configured: Boolean(envValue("NOTIFICATION_WEBHOOK_URL")),
      detail: envValue("NOTIFICATION_WEBHOOK_URL")
        ? "Configured for Make, Zapier, n8n, Slack, or another webhook receiver."
        : "Set NOTIFICATION_WEBHOOK_URL for quick live alerts.",
    },
    {
      id: "email-http",
      label: "Email HTTP",
      configured: Boolean(envValue("EMAIL_PROVIDER_URL") && envValue("ADMIN_NOTIFICATION_EMAIL")),
      detail: envValue("EMAIL_PROVIDER_URL") && envValue("ADMIN_NOTIFICATION_EMAIL")
        ? "Configured for admin email alerts and customer password reset email delivery."
        : envValue("EMAIL_PROVIDER_URL")
          ? "Configured for customer password reset emails. Set ADMIN_NOTIFICATION_EMAIL for admin email alerts."
          : "Set EMAIL_PROVIDER_URL for password reset emails and ADMIN_NOTIFICATION_EMAIL for admin email alerts.",
    },
    {
      id: "sms-http",
      label: "SMS HTTP",
      configured: Boolean(envValue("SMS_PROVIDER_URL") && envValue("ADMIN_NOTIFICATION_PHONE")),
      detail: envValue("SMS_PROVIDER_URL") && envValue("ADMIN_NOTIFICATION_PHONE")
        ? "Configured for a generic HTTP SMS provider endpoint."
        : "Set SMS_PROVIDER_URL and ADMIN_NOTIFICATION_PHONE for SMS delivery.",
    },
  ];

  return {
    channels: statuses,
    configuredChannels: statuses.filter((status) => status.configured),
  };
}

async function postJson(channel: NotificationChannel, event: NotificationEvent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deliveryTimeoutMs());
  const message = textSummary(event);
  const target = notificationTarget(channel, event);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (channel.token) {
    headers.Authorization = `Bearer ${channel.token}`;
  }

  try {
    const response = await fetch(channel.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "krishoe",
        channel: channel.id,
        to: target,
        subject: event.title,
        message,
        event,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${channel.label} returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readEventsFromLocalJson() {
  try {
    const content = await readFile(notificationsPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed)
      ? (parsed as NotificationEvent[]).map((event) => normalizeEvent(event))
      : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readEventsFromPostgres(limit = maxNotificationEvents) {
  const rows = await queryPostgres<NotificationEventRow>(
    "notification events",
    `
      SELECT
        id,
        created_at,
        type,
        title,
        payload,
        delivery_status,
        delivery_attempts,
        delivered_at,
        last_delivery_error,
        last_delivery_channel
      FROM notification_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return rows.map(eventFromRow);
}

async function writeEvents(events: NotificationEvent[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    notificationsPath,
    `${JSON.stringify(events.map((event) => normalizeEvent(event)).slice(0, maxNotificationEvents), null, 2)}\n`,
    "utf8",
  );
}

async function appendEventToPostgres(record: NotificationEvent) {
  const rows = await queryPostgres<NotificationEventRow>(
    "notification events",
    `
      INSERT INTO notification_events (
        id,
        created_at,
        type,
        title,
        payload,
        delivery_status,
        delivery_attempts,
        delivered_at,
        last_delivery_error,
        last_delivery_channel
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
      RETURNING
        id,
        created_at,
        type,
        title,
        payload,
        delivery_status,
        delivery_attempts,
        delivered_at,
        last_delivery_error,
        last_delivery_channel
    `,
    [
      record.id,
      new Date(record.createdAt),
      normalizeEventType(record.type),
      record.title,
      JSON.stringify(record.payload),
      record.deliveryStatus,
      record.deliveryAttempts,
      record.deliveredAt ? new Date(record.deliveredAt) : null,
      record.lastDeliveryError,
      record.lastDeliveryChannel,
    ],
  );

  await queryPostgres<{ id: string }>(
    "notification events",
    `
      DELETE FROM notification_events
      WHERE id NOT IN (
        SELECT id
        FROM notification_events
        ORDER BY created_at DESC
        LIMIT $1
      )
      RETURNING id
    `,
    [maxNotificationEvents],
  );

  return eventFromRow(rows[0]);
}

async function updateEventDelivery(
  id: string,
  update: Pick<
    NotificationEvent,
    "deliveryStatus" | "deliveryAttempts" | "deliveredAt" | "lastDeliveryError" | "lastDeliveryChannel"
  >,
) {
  return runWithDataBackend({
    storeName: "notification events",
    localJson: async () => {
      const events = await readEventsFromLocalJson();
      let updatedEvent: NotificationEvent | null = null;
      const nextEvents = events.map((event) => {
        if (event.id !== id) {
          return event;
        }

        updatedEvent = normalizeEvent({ ...event, ...update });
        return updatedEvent;
      });

      await writeEvents(nextEvents);
      return updatedEvent;
    },
    postgres: async () => {
      const rows = await queryPostgres<NotificationEventRow>(
        "notification events",
        `
          UPDATE notification_events
          SET
            delivery_status = $2,
            delivery_attempts = $3,
            delivered_at = $4,
            last_delivery_error = $5,
            last_delivery_channel = $6
          WHERE id = $1
          RETURNING
            id,
            created_at,
            type,
            title,
            payload,
            delivery_status,
            delivery_attempts,
            delivered_at,
            last_delivery_error,
            last_delivery_channel
        `,
        [
          id,
          update.deliveryStatus,
          update.deliveryAttempts,
          update.deliveredAt ? new Date(update.deliveredAt) : null,
          update.lastDeliveryError,
          update.lastDeliveryChannel,
        ],
      );

      return rows[0] ? eventFromRow(rows[0]) : null;
    },
  });
}

async function appendEvent(event: Omit<NotificationEvent, "id" | "createdAt" | "deliveryStatus" | "deliveryAttempts" | "deliveredAt" | "lastDeliveryError" | "lastDeliveryChannel">) {
  const record: NotificationEvent = {
    ...event,
    id: createId(),
    createdAt: new Date().toISOString(),
    deliveryStatus: "pending",
    deliveryAttempts: 0,
    lastDeliveryError: "",
    lastDeliveryChannel: "",
  };

  return runWithDataBackend({
    storeName: "notification events",
    localJson: async () => {
      const events = await readEventsFromLocalJson();
      await writeEvents([record, ...events]);
      return record;
    },
    postgres: () => appendEventToPostgres(record),
  });
}

export async function deliverNotificationEvent(event: NotificationEvent): Promise<NotificationDeliveryResult> {
  const normalizedEvent = normalizeEvent(event);

  if (normalizedEvent.deliveryStatus === "sent") {
    return {
      id: normalizedEvent.id,
      ok: true,
      status: "sent",
      attemptedChannels: [],
      successfulChannels: [],
      error: "",
    };
  }

  const channels = getConfiguredChannels(normalizedEvent);
  const nextAttempts = normalizedEvent.deliveryAttempts + 1;

  if (channels.length === 0) {
    const missingChannelMessage =
      normalizedEvent.type === "password-reset"
        ? "No customer password reset email channel is configured."
        : "No notification delivery channel is configured.";

    await updateEventDelivery(normalizedEvent.id, {
      deliveryStatus: "skipped",
      deliveryAttempts: nextAttempts,
      deliveredAt: undefined,
      lastDeliveryError: missingChannelMessage,
      lastDeliveryChannel: "",
    });

    return {
      id: normalizedEvent.id,
      ok: false,
      status: "skipped",
      attemptedChannels: [],
      successfulChannels: [],
      error: missingChannelMessage,
    };
  }

  const results = await Promise.all(
    channels.map(async (channel) => {
      try {
        await postJson(channel, normalizedEvent);
        return { channel: channel.id, ok: true, error: "" };
      } catch (error) {
        return {
          channel: channel.id,
          ok: false,
          error: error instanceof Error ? error.message : "Notification delivery failed.",
        };
      }
    }),
  );
  const successfulChannels = results.filter((result) => result.ok).map((result) => result.channel);
  const failedErrors = results.filter((result) => !result.ok).map((result) => `${result.channel}: ${result.error}`);
  const ok = successfulChannels.length > 0;
  const status: NotificationDeliveryStatus = ok ? "sent" : "failed";

  await updateEventDelivery(normalizedEvent.id, {
    deliveryStatus: status,
    deliveryAttempts: nextAttempts,
    deliveredAt: ok ? new Date().toISOString() : normalizedEvent.deliveredAt,
    lastDeliveryError: failedErrors.join(" | "),
    lastDeliveryChannel: successfulChannels.join(", "),
  });

  return {
    id: normalizedEvent.id,
    ok,
    status,
    attemptedChannels: results.map((result) => result.channel),
    successfulChannels,
    error: failedErrors.join(" | "),
  };
}

export async function deliverPendingNotifications(limit = 20) {
  const events = await getNotificationEvents(maxNotificationEvents);
  const pendingEvents = events
    .filter((event) => event.deliveryStatus === "pending" || event.deliveryStatus === "failed")
    .slice(0, Math.max(1, limit));
  const results: NotificationDeliveryResult[] = [];

  for (const event of pendingEvents.reverse()) {
    results.push(await deliverNotificationEvent(event));
  }

  return {
    attempted: results.length,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}

export async function retryNotificationEvent(id: string) {
  const events = await getNotificationEvents(maxNotificationEvents);
  const event = events.find((item) => item.id === id);

  if (!event) {
    throw new Error("Notification event was not found.");
  }

  return deliverNotificationEvent({ ...event, deliveryStatus: "pending" });
}

export async function notifyOrderReceived(order: OrderSubmission) {
  const event = await appendEvent({
    type: "order",
    title: `New order request ${order.id}`,
    payload: order,
  });

  await deliverNotificationEvent(event).catch(() => undefined);
  return event;
}

export async function notifyContactReceived(message: ContactSubmission) {
  const event = await appendEvent({
    type: "contact",
    title: `New contact message ${message.id}`,
    payload: message,
  });

  await deliverNotificationEvent(event).catch(() => undefined);
  return event;
}

export async function notifyPasswordResetRequested(payload: PasswordResetNotificationPayload) {
  const event = await appendEvent({
    type: "password-reset",
    title: "KRISHOE password reset request",
    payload,
  });

  await deliverNotificationEvent(event).catch(() => undefined);
  return event;
}

export async function getNotificationEvents(limit = 50) {
  return runWithDataBackend({
    storeName: "notification events",
    localJson: async () => {
      const events = await readEventsFromLocalJson();
      return events.slice(0, limit);
    },
    postgres: () => readEventsFromPostgres(limit),
  });
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function severityRank(severity: OperationalAlertSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function alertAmountRank(alert: OperationalAlert) {
  return alert.amount ?? 0;
}

export async function getOperationalAlertCenter(): Promise<OperationalAlertCenter> {
  const [operations, purchasing, pos, paymentReconciliation, products] = await Promise.all([
    getOperationsSnapshot(),
    getPurchasingSnapshot(),
    getPosSnapshot(),
    getPaymentReconciliation(),
    getProducts({ includeDrafts: true }),
  ]);
  const alerts: OperationalAlert[] = [];

  for (const ledger of operations.reports.ledgerCollectionFollowups.slice(0, 5)) {
    if (ledger.priority === "Clear") continue;

    alerts.push({
      id: `collection-${ledger.id}`,
      category: "collection",
      severity: ledger.priority === "Urgent" || ledger.priority === "High" ? "critical" : "warning",
      title: `${ledger.customerName} collection ${ledger.priority}`,
      detail: `${money(ledger.balanceDue)} due, ${ledger.daysOutstanding} days outstanding.`,
      action: ledger.nextAction,
      href: `/admin/operations/ledger/${ledger.id}`,
      amount: ledger.balanceDue,
    });
  }

  for (const supplier of purchasing.reports.supplierPaymentFollowups.slice(0, 5)) {
    if (supplier.priority === "Clear") continue;

    alerts.push({
      id: `supplier-${supplier.supplierLedgerId}`,
      category: "supplier",
      severity: supplier.priority === "Immediate" || supplier.priority === "High" ? "critical" : "warning",
      title: `${supplier.supplierName} payable ${supplier.priority}`,
      detail: `${money(supplier.balanceDue)} supplier due, oldest ${supplier.oldestOpenDays} days.`,
      action: supplier.nextAction,
      href: `/admin/purchasing/supplier/${supplier.supplierLedgerId}`,
      amount: supplier.balanceDue,
    });
  }

  for (const stock of operations.reports.stockLedgerRows.slice(0, 5)) {
    if (stock.signal === "Balanced") continue;

    alerts.push({
      id: `stock-ledger-${stock.id}`,
      category: "stock",
      severity: stock.signal === "Variance" ? "critical" : "warning",
      title: `${stock.design} stock ledger ${stock.signal}`,
      detail: `${stock.channel} book ${stock.stockPairs}, movement ${stock.movementStockPairs}, variance ${stock.variancePairs}.`,
      action: stock.nextAction,
      href: "/admin/operations",
      amount: Math.abs(stock.variancePairs),
    });
  }

  for (const product of products.filter((item) => item.status === "Active" && item.stock <= 5).slice(0, 5)) {
    alerts.push({
      id: `catalog-low-${product.id}`,
      category: "catalog",
      severity: product.stock <= 0 ? "critical" : "warning",
      title: `${product.name} catalog stock low`,
      detail: `${product.stock} pair(s) available in online catalog.`,
      action: "Sync with operations stock or plan replenishment before online selling.",
      href: "/admin/products",
      amount: product.stock,
    });
  }

  if (pos.summary.needsReview > 0) {
    alerts.push({
      id: "pos-posting-review",
      category: "posting",
      severity: "critical",
      title: "POS posting needs review",
      detail: `${pos.summary.needsReview} POS invoice(s) need stock or ledger posting review.`,
      action: "Open POS posting health and repair or review invoices.",
      href: "/admin/pos",
      amount: pos.summary.needsReview,
    });
  }

  if (purchasing.summary.postingNeedsReview > 0) {
    alerts.push({
      id: "purchase-posting-review",
      category: "posting",
      severity: "warning",
      title: "Purchase posting needs review",
      detail: `${purchasing.summary.postingNeedsReview} purchase invoice(s) need supplier/raw material posting review.`,
      action: "Open purchasing posting health and fix missing supplier/material links.",
      href: "/admin/purchasing",
      amount: purchasing.summary.postingNeedsReview,
    });
  }

  for (const issue of paymentReconciliation.issues.slice(0, 5)) {
    alerts.push({
      id: `payment-${issue.id}`,
      category: "payment",
      severity: issue.severity === "high" ? "critical" : "warning",
      title: issue.type,
      detail: issue.detail,
      action: issue.recommendation,
      href: "/admin/payments",
    });
  }

  const sortedAlerts = alerts.sort(
    (left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      alertAmountRank(right) - alertAmountRank(left),
  );

  return {
    alerts: sortedAlerts,
    summary: {
      total: sortedAlerts.length,
      critical: sortedAlerts.filter((alert) => alert.severity === "critical").length,
      warning: sortedAlerts.filter((alert) => alert.severity === "warning").length,
      info: sortedAlerts.filter((alert) => alert.severity === "info").length,
    },
  };
}

function operationalAlertTitle(alert: OperationalAlert) {
  return `Operational alert: ${alert.title}`;
}

export async function createOperationalAlertNotifications(limit = 10) {
  const [alertCenter, existingEvents] = await Promise.all([
    getOperationalAlertCenter(),
    getNotificationEvents(maxNotificationEvents),
  ]);
  const existingOpenAlertIds = new Set(
    existingEvents
      .filter((event) => event.type === "operational-alert" && event.deliveryStatus !== "sent")
      .map((event) => (event.payload as OperationalAlertNotificationPayload).alertId),
  );
  const alertsToCreate = alertCenter.alerts
    .filter((alert) => alert.severity === "critical" || alert.severity === "warning")
    .filter((alert) => !existingOpenAlertIds.has(alert.id))
    .slice(0, Math.max(1, Math.min(50, limit)));
  const createdEvents: NotificationEvent[] = [];

  for (const alert of alertsToCreate) {
    createdEvents.push(
      await appendEvent({
        type: "operational-alert",
        title: operationalAlertTitle(alert),
        payload: {
          alertId: alert.id,
          category: alert.category,
          severity: alert.severity,
          detail: alert.detail,
          action: alert.action,
          href: alert.href,
          amount: alert.amount,
        },
      }),
    );
  }

  return {
    created: createdEvents.length,
    skippedExisting: alertCenter.alerts.length - alertsToCreate.length,
    totalAlerts: alertCenter.summary.total,
    criticalAlerts: alertCenter.summary.critical,
    warningAlerts: alertCenter.summary.warning,
    events: createdEvents,
  };
}

export async function createAndDeliverOperationalAlertNotifications(limit = 10) {
  const created = await createOperationalAlertNotifications(limit);
  const delivery = await deliverPendingNotifications(limit);

  return {
    ...created,
    delivery,
  };
}
