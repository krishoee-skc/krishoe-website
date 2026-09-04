import Link from "next/link";
import T from "@/components/T";
import { customerStage, STAGE_META, followUpMessage, type CustomerStage } from "@/lib/customer-stage";
import { whatsappToUrl } from "@/lib/commerce";
import StatCard from "@/components/admin/StatTile";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import {
  invalidateCustomerSessionsAction,
  markCustomerPhoneVerifiedAction,
  sendCustomerEmailVerificationAction,
  sendCustomerPasswordResetAction,
} from "@/app/admin/customers/actions";
import { DateDisplayAdmin } from "@/components/DateDisplay";
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
  closedOrders: number;
  stage: CustomerStage;
};

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
    return "inline-flex min-h-9 items-center justify-center rounded-full border border-brand-clay/30 bg-brand-paper px-3 text-xs font-black text-brand-clay transition hover:bg-brand-clay-mist";
  }

  return "inline-flex min-h-9 items-center justify-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green hover:text-brand-green";
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
    const closedOrders = linkedOrders.filter((order) => order.status === "Closed").length;
    const stage = customerStage(closedOrders, linkedOrders.length > 0);

    return {
      user,
      linkedOrders,
      directOrders,
      guestMatches,
      openOrders,
      pendingPayments,
      latestOrder: linkedOrders[0],
      closedOrders,
      stage,
    };
  });
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
  // How the customers spread across the CRM ladder, for the summary strip.
  const stageCounts = rows.reduce(
    (counts, row) => {
      counts[row.stage] += 1;
      return counts;
    },
    { New: 0, Interested: 0, Ordered: 0, Repeat: 0, VIP: 0 } as Record<CustomerStage, number>,
  );
  const emailChannel = deliveryConfig.channels.find((channel) => channel.id === "email-http");

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            <T en="People" ne="ग्राहक" />
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink"><T en="Customers" ne="ग्राहक" /></h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            Customer account trust, order links, verification emails, and manual phone checks.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="inline-flex h-9 items-center rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
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

      {/* The CRM ladder at a glance — how many customers sit at each stage, so
          the owner sees who to keep close (VIP, Repeat) and who to welcome (New)
          without reading the whole list. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["VIP", "Repeat", "Ordered", "Interested", "New"] as const).map((stage) => (
          <span
            key={stage}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${STAGE_META[stage].className}`}
          >
            <span aria-hidden="true">{STAGE_META[stage].icon}</span>
            <T en={STAGE_META[stage].en} ne={STAGE_META[stage].ne} />
            <span className="tabular-nums">{stageCounts[stage]}</span>
          </span>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink"><T en="Account email delivery" ne="खाताको email पुग्यो कि पुगेन" /></h2>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
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
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          {emailChannel?.detail ?? "Set EMAIL_PROVIDER_URL for customer account emails."}
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink"><T en="Customer list" ne="ग्राहकको सूची" /></h2>
            <p className="mt-1 text-sm text-brand-muted">
              Newest accounts first. Actions create audit and notification history.
            </p>
          </div>
          <Link href="/admin/orders" className="text-sm font-bold text-brand-green underline underline-offset-4">
            Orders
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
            No customer accounts yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="reflow-table min-w-full text-sm">
              <thead className="border-b text-left text-brand-muted">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-brand-green-ink">{row.user.name}</p>
                        {/* The CRM stage — where this customer is in the shop's
                            relationship with them, from their orders alone. */}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${STAGE_META[row.stage].className}`}>
                          <span aria-hidden="true">{STAGE_META[row.stage].icon}</span>
                          <T en={STAGE_META[row.stage].en} ne={STAGE_META[row.stage].ne} />
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-brand-muted">{row.user.email}</p>
                      <p className="mt-1 text-xs text-brand-muted">
                        {row.user.phone || "No phone saved"}
                        {row.closedOrders > 0 ? (
                          <span className="ml-1 text-brand-green">
                            · <T en={`${row.closedOrders} bought`} ne={`${row.closedOrders} पटक किन्यो`} />
                          </span>
                        ) : null}
                      </p>
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
                    <td data-label="Orders" className="py-3 pr-3 text-brand-muted">
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
                    <td data-label="Latest" className="py-3 pr-3 text-xs text-brand-muted">
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
                      <p className="mt-1">{row.latestOrder?.createdAt ? <DateDisplayAdmin date={row.latestOrder.createdAt} time={true} /> : "-"}</p>
                    </td>
                    <td data-label="Actions" className="py-3 pr-3">
                      <div className="flex min-w-56 flex-wrap gap-2">
                        {/* Follow up on WhatsApp — a stage-aware greeting the
                            owner can send in one tap to keep a customer close.
                            Only shown when there is a phone to reach them on. */}
                        {row.user.phone ? (
                          <a
                            href={whatsappToUrl(row.user.phone, followUpMessage(row.stage, row.user.name))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-[#25D366] px-3 text-xs font-black text-white transition hover:brightness-95"
                          >
                            💬 <T en="WhatsApp" ne="WhatsApp" />
                          </a>
                        ) : null}
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
