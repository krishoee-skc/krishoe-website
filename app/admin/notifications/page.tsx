import Link from "next/link";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import ExportButton from "@/components/admin/ExportButton";
import PushNotificationSetup from "@/components/admin/PushNotificationSetup";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  createAndDeliverOperationalAlertNotificationsAction,
  createOperationalAlertNotificationsAction,
  deliverPendingNotificationsAction,
  retryNotificationAction,
  sendSalesReportNowAction,
} from "@/app/admin/notifications/actions";
import {
  getOperationalAlertCenter,
  getNotificationDeliveryConfig,
  getNotificationEvents,
  type EmailVerificationNotificationPayload,
  type OperationalAlertSeverity,
  type PasswordResetNotificationPayload,
  type NotificationDeliveryStatus,
  type NotificationEvent,
} from "@/lib/notifications";
import type { ContactSubmission, OrderSubmission } from "@/lib/submissions";

export const metadata = {
  title: "Notifications | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function statusClass(status: NotificationDeliveryStatus) {
  if (status === "sent") return "bg-brand-green-tint text-brand-green";
  if (status === "failed") return "bg-brand-clay-tint text-brand-clay";
  if (status === "skipped") return "bg-brand-mist text-brand-muted-deep";
  return "bg-brand-cream-soft text-brand-gold-ink";
}

function channelClass(configured: boolean) {
  return configured ? "border-brand-green-line bg-brand-green-wash text-brand-green" : "border-brand-green-line bg-brand-paper-deep text-brand-muted";
}

function alertClass(severity: OperationalAlertSeverity) {
  if (severity === "critical") return "bg-brand-clay-tint text-brand-clay";
  if (severity === "warning") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-green-tint text-brand-green";
}

function customerLabel(event: NotificationEvent) {
  if (event.type === "order") {
    return (event.payload as OrderSubmission).name;
  }

  if (event.type === "password-reset" || event.type === "email-verification") {
    return "Customer account";
  }

  if (event.type === "operational-alert") {
    return "Business alert";
  }

  return (event.payload as ContactSubmission).name;
}

function targetLabel(event: NotificationEvent) {
  if (event.type === "order") {
    return (event.payload as OrderSubmission).phone;
  }

  if (event.type === "password-reset" || event.type === "email-verification") {
    return (event.payload as PasswordResetNotificationPayload | EmailVerificationNotificationPayload).email;
  }

  if (event.type === "operational-alert") {
    const payload = event.payload as { category?: string; severity?: string };
    return `${payload.category ?? "operations"} / ${payload.severity ?? "alert"}`;
  }

  return (event.payload as ContactSubmission).email;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminNotificationsPage() {
  const [events, config, alertCenter] = await Promise.all([
    getNotificationEvents(120),
    Promise.resolve(getNotificationDeliveryConfig()),
    getOperationalAlertCenter(),
  ]);
  const pending = events.filter((event) => event.deliveryStatus === "pending");
  const failed = events.filter((event) => event.deliveryStatus === "failed");
  const sent = events.filter((event) => event.deliveryStatus === "sent");
  const skipped = events.filter((event) => event.deliveryStatus === "skipped");

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Notification delivery</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            Live alert queue for new orders, contact messages, and customer account emails.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createOperationalAlertNotificationsAction}>
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green">
              Create alert notifications
            </FormSubmitButton>
          </form>
          <form action={createAndDeliverOperationalAlertNotificationsAction}>
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-brand-green bg-brand-paper px-3 text-xs font-bold text-brand-green">
              Create and deliver alerts
            </FormSubmitButton>
          </form>
          <form action={deliverPendingNotificationsAction}>
            <FormSubmitButton className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white">
              Deliver pending
            </FormSubmitButton>
          </form>
          <ExportButton
            href="/api/admin/notifications/export"
            className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            Export CSV
          </ExportButton>
        </div>
      </div>

      {/* Placed first because it is the only channel that reaches the owner
          when the admin app is closed, which is most of the day. */}
      <div className="mt-6">
        <PushNotificationSetup publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Business alerts" value={alertCenter.summary.total} detail={`${alertCenter.summary.critical} critical`} />
        <StatCard label="Pending" value={pending.length} detail="waiting delivery" />
        <StatCard label="Sent" value={sent.length} detail="delivered alerts" />
        <StatCard label="Failed" value={failed.length} detail="needs review" />
        <StatCard label="Skipped" value={skipped.length} detail="no channel configured" />
      </div>

      <section className="mt-8 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Sales report delivery check</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
              Daily runs every evening with a one-hour backup. Sunday also sends the weekly
              digest; Bikram Sambat month-start also sends the monthly digest.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 min-[430px]:grid-cols-3 md:w-auto">
            {(["daily", "weekly", "monthly"] as const).map((kind) => (
              <form key={kind} action={sendSalesReportNowAction}>
                <input type="hidden" name="kind" value={kind} />
                <FormSubmitButton className="min-h-11 w-full rounded-full border border-brand-green bg-brand-paper px-4 text-xs font-black capitalize text-brand-green transition hover:bg-brand-green hover:text-white">
                  Send {kind} now
                </FormSubmitButton>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Operational alert center</h2>
            <p className="mt-1 text-sm text-brand-muted">
              Live business alerts from collection, supplier payable, stock, POS, purchasing, and payment reconciliation.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Dashboard
          </Link>
        </div>

        {alertCenter.alerts.length === 0 ? (
          <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-green">
            No operational alert is active right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Alert</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Severity</th>
                  <th className="py-2 pr-3">Detail</th>
                  <th className="py-2 pr-3">Next action</th>
                  <th className="py-2 pr-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alertCenter.alerts.slice(0, 20).map((alert) => (
                  <tr key={alert.id}>
                    <td className="reflow-primary py-3 pr-3 font-bold text-brand-green-ink">{alert.title}</td>
                    <td data-label="Category" className="py-3 pr-3 capitalize text-brand-muted">{alert.category}</td>
                    <td data-label="Severity" className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${alertClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td data-label="Detail" className="max-w-80 py-3 pr-3 text-brand-muted">{alert.detail}</td>
                    <td data-label="Next action" className="max-w-96 py-3 pr-3 text-xs font-semibold leading-5 text-brand-muted">
                      {alert.action}
                    </td>
                    <td data-label="Open" className="py-3 pr-3">
                      <Link
                        href={alert.href}
                        className="font-bold text-brand-green underline underline-offset-4"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {config.channels.map((channel) => (
          <div
            key={channel.id}
            className={`rounded-lg border p-4 shadow-sm ${channelClass(channel.configured)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black">{channel.label}</h2>
              <span className="rounded-full bg-brand-paper/70 px-2.5 py-1 text-xs font-black">
                {channel.configured ? "Ready" : "Missing"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 opacity-80">{channel.detail}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Recent notifications</h2>
            <p className="mt-1 text-sm text-brand-muted">Newest order, contact, and account alert events.</p>
          </div>
          <Link href="/admin/activity" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Activity log
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
            No notification events yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
                <tr>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Attempts</th>
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 pr-3">Last error</th>
                  <th className="py-2 pr-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="reflow-primary whitespace-nowrap py-3 pr-3 text-xs text-brand-muted">
                      <DateDisplayAdmin date={event.createdAt} time={true} />
                    </td>
                    <td data-label="Type" className="py-3 pr-3 font-bold capitalize text-brand-green-ink">{event.type}</td>
                    <td data-label="Customer" className="py-3 pr-3 font-semibold text-brand-green-ink">{customerLabel(event)}</td>
                    <td data-label="Target" className="py-3 pr-3 text-brand-muted">{targetLabel(event)}</td>
                    <td data-label="Status" className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(event.deliveryStatus)}`}>
                        {event.deliveryStatus}
                      </span>
                    </td>
                    <td data-label="Attempts" className="py-3 pr-3 font-bold">{event.deliveryAttempts}</td>
                    <td data-label="Channel" className="py-3 pr-3 text-brand-muted">{event.lastDeliveryChannel || "-"}</td>
                    <td data-label="Last error" className="max-w-72 py-3 pr-3 text-xs text-brand-muted">
                      {event.lastDeliveryError || (event.deliveredAt ? <>Delivered <DateDisplayAdmin date={event.deliveredAt} time={true} /></> : "-")}
                    </td>
                    <td data-label="Action" className="py-3 pr-3">
                      {event.deliveryStatus !== "sent" ? (
                        <form action={retryNotificationAction}>
                          <input type="hidden" name="id" value={event.id} />
                          <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-brand-green-line px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green">
                            Retry
                          </FormSubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
