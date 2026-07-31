import Link from "next/link";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  invalidateCustomerSessionsAction,
  markCustomerPhoneVerifiedAction,
  sendCustomerEmailVerificationAction,
  sendCustomerPasswordResetAction,
} from "@/app/admin/customers/actions";
import { formatAdminDate } from "@/lib/format-date";
import { getNotificationDeliveryConfig } from "@/lib/notifications";
import {
  getOrders,
  orderMatchesCustomer,
  type OrderSubmission,
} from "@/lib/submissions";
import { getSafeUsers, type SafeUser } from "@/lib/user-store";

export const metadata = {
  title: "Customers | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type CustomerRow = {
  user: SafeUser;
  linkedOrders: OrderSubmission[];
  directOrders: OrderSubmission[];
  guestMatches: OrderSubmission[];
  openOrders: OrderSubmission[];
  pendingPayments: OrderSubmission[];
  latestOrder?: OrderSubmission;
};

function formatDate(value?: string) {
  return value ? formatAdminDate(value, { time: true }) : "-";
}

function trustClass(verified: boolean) {
  return verified
    ? "bg-brand-green-tint text-brand-green"
    : "bg-brand-cream-soft text-brand-gold-ink";
}

function buttonClass(tone: "primary" | "quiet" | "danger" = "quiet") {
  if (tone === "primary") {
    return "inline-flex min-h-9 items-center justify-center rounded-full bg-brand-green px-3 text-xs font-black text-white transition hover:bg-brand-green-ink";
  }

  if (tone === "danger") {
    return "inline-flex min-h-9 items-center justify-center rounded-full border border-brand-clay/30 bg-white px-3 text-xs font-black text-brand-clay transition hover:bg-brand-clay-mist";
  }

  return "inline-flex min-h-9 items-center justify-center rounded-full border border-gray-200 bg-white px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green";
}

function buildCustomerRows(users: SafeUser[], orders: OrderSubmission[]): CustomerRow[] {
  return users.map((user) => {
    const linkedOrders = orders.filter((order) => orderMatchesCustomer(order, user));
    const directOrders = linkedOrders.filter((order) => order.customerUserId === user.id);
    const guestMatches = linkedOrders.filter((order) => order.customerUserId !== user.id);
    const openOrders = linkedOrders.filter((order) => order.status !== "Closed" && order.status !== "Cancelled");
    const pendingPayments = linkedOrders.filter(
      (order) => order.paymentStatus === "Pending" || order.paymentStatus === "Unpaid",
    );

    return {
      user,
      linkedOrders,
      directOrders,
      guestMatches,
      openOrders,
      pendingPayments,
      latestOrder: linkedOrders[0],
    };
  });
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminCustomersPage() {
  const [users, orders, deliveryConfig] = await Promise.all([
    getSafeUsers(),
    getOrders(),
    Promise.resolve(getNotificationDeliveryConfig()),
  ]);
  const rows = buildCustomerRows(users, orders);
  const verifiedEmail = users.filter((user) => user.emailVerifiedAt).length;
  const verifiedPhone = users.filter((user) => user.phoneVerifiedAt).length;
  const customersWithOrders = rows.filter((row) => row.linkedOrders.length > 0).length;
  const emailChannel = deliveryConfig.channels.find((channel) => channel.id === "email-http");

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Customers</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Customer account trust, order links, verification emails, and manual phone checks.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Notification queue
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Customers" value={users.length} detail="registered accounts" />
        <StatCard label="Email verified" value={verifiedEmail} detail="safe guest matching" />
        <StatCard label="Phone verified" value={verifiedPhone} detail="manual trust checks" />
        <StatCard label="With orders" value={customersWithOrders} detail="linked history" />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Account email delivery</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Verification and password reset messages use the Email HTTP channel.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              emailChannel?.configured
                ? "bg-brand-green-tint text-brand-green"
                : "bg-brand-clay-tint text-brand-clay"
            }`}
          >
            {emailChannel?.configured ? "Ready" : "Missing"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {emailChannel?.detail ?? "Set EMAIL_PROVIDER_URL for customer account emails."}
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">Customer list</h2>
            <p className="mt-1 text-sm text-gray-500">
              Newest accounts first. Actions create audit and notification history.
            </p>
          </div>
          <Link href="/admin/orders" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Orders
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            No customer accounts yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Trust</th>
                  <th className="py-2 pr-3">Orders</th>
                  <th className="py-2 pr-3">Open</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">Latest</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.user.id}>
                    <td className="reflow-primary py-3 pr-3">
                      <p className="font-black text-brand-green-ink">{row.user.name}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{row.user.email}</p>
                      <p className="mt-1 text-xs text-gray-500">{row.user.phone || "No phone saved"}</p>
                    </td>
                    <td data-label="Trust" className="py-3 pr-3">
                      <div className="grid gap-1.5">
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${trustClass(Boolean(row.user.emailVerifiedAt))}`}>
                          Email {row.user.emailVerifiedAt ? "verified" : "pending"}
                        </span>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${trustClass(Boolean(row.user.phoneVerifiedAt))}`}>
                          Phone {row.user.phoneVerifiedAt ? "verified" : "pending"}
                        </span>
                      </div>
                    </td>
                    <td data-label="Orders" className="py-3 pr-3 text-gray-600">
                      <p className="font-black text-brand-green-ink">{row.linkedOrders.length}</p>
                      <p className="mt-1 text-xs">
                        {row.directOrders.length} direct / {row.guestMatches.length} trusted guest
                      </p>
                    </td>
                    <td data-label="Open" className="py-3 pr-3 font-bold text-brand-green-ink">
                      {row.openOrders.length}
                    </td>
                    <td data-label="Payment" className="py-3 pr-3 font-bold text-brand-green-ink">
                      {row.pendingPayments.length}
                    </td>
                    <td data-label="Latest" className="py-3 pr-3 text-xs text-gray-500">
                      {row.latestOrder ? (
                        <Link
                          href={`/admin/orders#${row.latestOrder.id}`}
                          className="font-bold text-brand-green underline underline-offset-4"
                        >
                          {row.latestOrder.id}
                        </Link>
                      ) : (
                        "-"
                      )}
                      <p className="mt-1">{formatDate(row.latestOrder?.createdAt)}</p>
                    </td>
                    <td data-label="Actions" className="py-3 pr-3">
                      <div className="flex min-w-56 flex-wrap gap-2">
                        <form action={sendCustomerEmailVerificationAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <FormSubmitButton
                            className={buttonClass("quiet")}
                            pendingLabel="Sending..."
                            disabled={Boolean(row.user.emailVerifiedAt)}
                          >
                            Verify email
                          </FormSubmitButton>
                        </form>
                        <form action={markCustomerPhoneVerifiedAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <FormSubmitButton
                            className={buttonClass("primary")}
                            pendingLabel="Saving..."
                            disabled={!row.user.phone || Boolean(row.user.phoneVerifiedAt)}
                          >
                            Verify phone
                          </FormSubmitButton>
                        </form>
                        <form action={sendCustomerPasswordResetAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <FormSubmitButton className={buttonClass("quiet")} pendingLabel="Sending...">
                            Reset password
                          </FormSubmitButton>
                        </form>
                        <form action={invalidateCustomerSessionsAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <FormSubmitButton className={buttonClass("danger")} pendingLabel="Ending...">
                            End sessions
                          </FormSubmitButton>
                        </form>
                      </div>
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
