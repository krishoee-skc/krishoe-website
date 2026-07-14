import Link from "next/link";
import {
  createAndDeliverOperationalAlertNotificationsAction,
  createOperationalAlertNotificationsAction,
  deliverPendingNotificationsAction,
  retryNotificationAction,
} from "@/app/admin/notifications/actions";
import {
  getOperationalAlertCenter,
  getNotificationDeliveryConfig,
  getNotificationEvents,
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
  if (status === "sent") return "bg-[#EAF5EF] text-[#0B4D3B]";
  if (status === "failed") return "bg-[#FBEAE8] text-[#7B3128]";
  if (status === "skipped") return "bg-gray-100 text-gray-700";
  return "bg-[#FFF7DF] text-[#7A5A00]";
}

function channelClass(configured: boolean) {
  return configured ? "border-[#D9E8DF] bg-[#F4FBF6] text-[#0B4D3B]" : "border-gray-200 bg-gray-50 text-gray-600";
}

function alertClass(severity: OperationalAlertSeverity) {
  if (severity === "critical") return "bg-[#FBEAE8] text-[#7B3128]";
  if (severity === "warning") return "bg-[#FFF7DF] text-[#7A5A00]";
  return "bg-[#EAF5EF] text-[#0B4D3B]";
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function customerLabel(event: NotificationEvent) {
  if (event.type === "order") {
    return (event.payload as OrderSubmission).name;
  }

  if (event.type === "password-reset") {
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

  if (event.type === "password-reset") {
    return (event.payload as PasswordResetNotificationPayload).email;
  }

  if (event.type === "operational-alert") {
    const payload = event.payload as { category?: string; severity?: string };
    return `${payload.category ?? "operations"} / ${payload.severity ?? "alert"}`;
  }

  return (event.payload as ContactSubmission).email;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#10231D]">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A958F]">
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
          <h1 className="text-2xl font-black text-[#10231D]">Notification delivery</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Live alert queue for new orders, contact messages, and customer account emails.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createOperationalAlertNotificationsAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
            >
              Create alert notifications
            </button>
          </form>
          <form action={createAndDeliverOperationalAlertNotificationsAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full border border-[#0B4D3B] bg-white px-3 text-xs font-bold text-[#0B4D3B]"
            >
              Create and deliver alerts
            </button>
          </form>
          <form action={deliverPendingNotificationsAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-[#0B4D3B] px-3 text-xs font-bold text-white"
            >
              Deliver pending
            </button>
          </form>
          <a
            href="/api/admin/notifications/export"
            className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Business alerts" value={alertCenter.summary.total} detail={`${alertCenter.summary.critical} critical`} />
        <StatCard label="Pending" value={pending.length} detail="waiting delivery" />
        <StatCard label="Sent" value={sent.length} detail="delivered alerts" />
        <StatCard label="Failed" value={failed.length} detail="needs review" />
        <StatCard label="Skipped" value={skipped.length} detail="no channel configured" />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Operational alert center</h2>
            <p className="mt-1 text-sm text-gray-500">
              Live business alerts from collection, supplier payable, stock, POS, purchasing, and payment reconciliation.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-bold text-[#0B4D3B] underline underline-offset-4">
            Dashboard
          </Link>
        </div>

        {alertCenter.alerts.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-[#0B4D3B]">
            No operational alert is active right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
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
                    <td className="py-3 pr-3 font-bold text-[#10231D]">{alert.title}</td>
                    <td className="py-3 pr-3 capitalize text-gray-600">{alert.category}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${alertClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="max-w-80 py-3 pr-3 text-gray-600">{alert.detail}</td>
                    <td className="max-w-96 py-3 pr-3 text-xs font-semibold leading-5 text-gray-600">
                      {alert.action}
                    </td>
                    <td className="py-3 pr-3">
                      <Link
                        href={alert.href}
                        className="font-bold text-[#0B4D3B] underline underline-offset-4"
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
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black">
                {channel.configured ? "Ready" : "Missing"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 opacity-80">{channel.detail}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#10231D]">Recent notifications</h2>
            <p className="mt-1 text-sm text-gray-500">Newest order, contact, and account alert events.</p>
          </div>
          <Link href="/admin/activity" className="text-sm font-bold text-[#0B4D3B] underline underline-offset-4">
            Activity log
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            No notification events yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
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
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-gray-500">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="py-3 pr-3 font-bold capitalize text-[#10231D]">{event.type}</td>
                    <td className="py-3 pr-3 font-semibold text-[#10231D]">{customerLabel(event)}</td>
                    <td className="py-3 pr-3 text-gray-600">{targetLabel(event)}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(event.deliveryStatus)}`}>
                        {event.deliveryStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-bold">{event.deliveryAttempts}</td>
                    <td className="py-3 pr-3 text-gray-600">{event.lastDeliveryChannel || "-"}</td>
                    <td className="max-w-72 py-3 pr-3 text-xs text-gray-500">
                      {event.lastDeliveryError || (event.deliveredAt ? `Delivered ${formatDate(event.deliveredAt)}` : "-")}
                    </td>
                    <td className="py-3 pr-3">
                      {event.deliveryStatus !== "sent" ? (
                        <form action={retryNotificationAction}>
                          <input type="hidden" name="id" value={event.id} />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
                          >
                            Retry
                          </button>
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
