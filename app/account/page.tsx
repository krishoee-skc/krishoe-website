import type { Metadata } from "next";
import T from "@/components/T";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EmailVerificationPanel from "@/components/account/EmailVerificationPanel";
import OrderClaimForm from "@/components/account/OrderClaimForm";
import PasswordChangeForm from "@/components/account/PasswordChangeForm";
import ProfileEditForm from "@/components/account/ProfileEditForm";
import {
  logoutAllCustomerSessionsAction,
  logoutCustomerAction,
} from "@/app/account/actions";
import { getCurrentCustomer } from "@/lib/customer-auth";
import ReferralCard from "@/components/ReferralCard";
import { referralSummary } from "@/lib/referrals";
import { reportingErrors } from "@/lib/report-error";
import { absoluteUrl } from "@/lib/seo";
import {
  getOrdersForCustomer,
  type OrderSubmission,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/submissions";
import { formatAdminDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "My Account | KRISHOE",
  description: "Manage your KRISHOE customer account.",
};

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams?: Promise<{
    session?: string;
    verified?: string;
  }>;
};

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function orderStatusClass(status: OrderStatus) {
  if (status === "Closed") return "bg-brand-green-tint text-brand-green";
  if (status === "Contacted") return "bg-[#EEF2FF] text-[#3730A3]";
  return "bg-brand-cream-soft text-brand-gold-ink";
}

function paymentStatusClass(status: PaymentStatus) {
  if (status === "Paid") return "bg-brand-green-tint text-brand-green";
  if (status === "Failed" || status === "Refunded") return "bg-brand-clay-tint text-brand-clay";
  if (status === "Pending") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-gray-100 text-gray-700";
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function OrderHistory({ orders }: { orders: OrderSubmission[] }) {
  return (
    <section className="mt-6 rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-brand-green-ink">
            <T en="Order history" ne="अर्डरको इतिहास" />
          </h2>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            <T en="Requests linked by account id, verified email, or verified phone." ne="खाता, इमेल वा फोन मिलेका अर्डर यहाँ देखिन्छन्।" />
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex h-9 items-center rounded-full border border-brand-green px-3 text-xs font-bold text-brand-green transition hover:bg-brand-mist"
        >
          <T en="Shop again" ne="फेरि किन्ने" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-black/10 bg-brand-mist p-5">
          <p className="text-sm font-semibold text-brand-green-ink">
            <T en="No linked order request yet." ne="अझै कुनै अर्डर छैन।" />
          </p>
            <p className="mt-1 text-sm leading-6 text-brand-muted">
            Sign in before checkout or verify your email to safely link older guest order requests.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-brand-muted">
              <tr>
                <th className="py-2 pr-3"><T en="Reference" ne="अर्डर नम्बर" /></th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3"><T en="Total" ne="जम्मा" /></th>
                <th className="py-2 pr-3"><T en="Order" ne="सामान" /></th>
                <th className="py-2 pr-3"><T en="Payment" ne="भुक्तानी" /></th>
                <th className="py-2 pr-3">
                  <span className="sr-only"><T en="Action" ne="कारबाही" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap py-3 pr-3 font-mono text-xs text-brand-green-ink">{order.id}</td>
                  <td className="whitespace-nowrap py-3 pr-3 text-xs text-brand-muted">{formatDate(order.createdAt)}</td>
                  <td className="whitespace-nowrap py-3 pr-3 font-bold text-brand-green-ink">{order.total || "-"}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusClass(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 text-right">
                    <Link
                      href={`/order/${order.id}`}
                      className="inline-flex h-8 items-center rounded-full border border-black/10 px-3 text-xs font-bold text-brand-green transition hover:bg-brand-mist"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentCustomer();
  const resolvedSearchParams = await searchParams;

  if (!user) {
    redirect("/account/login");
  }

  const orders = await getOrdersForCustomer(user);
  const openOrders = orders.filter((order) => order.status !== "Closed");
  const pendingPayments = orders.filter((order) => order.paymentStatus === "Pending" || order.paymentStatus === "Unpaid");
  const latestOrder = orders[0];
  // Made on first sight of this page rather than at signup: a code nobody has
  // seen is a row nobody needed.
  const referral = await reportingErrors(`referral summary for ${user.id}`, () =>
    referralSummary(user.id),
  ).catch(() => null);

  return (
    <main className="bg-brand-mist">
      <Navbar isLoggedIn />
      <section className="mx-auto max-w-5xl px-5 py-16 md:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
              <T en="My account" ne="मेरो खाता" />
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-5xl">
              Namaste, {user.name}.
            </h1>
            <p className="mt-3 text-sm leading-7 text-brand-muted">
              <T en="Manage your saved checkout details for faster KRISHOE order requests." ne="ठेगाना र विवरण यहीँ राख्नुहोस् — अर्को पटक अर्डर छिटो हुन्छ।" />
            </p>
          </div>
          <form action={logoutCustomerAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
            >
              <T en="Sign out" ne="लगआउट" />
            </button>
          </form>
        </div>

        {resolvedSearchParams?.verified === "success" ? (
          <p className="mb-6 rounded-lg bg-brand-green-mist p-4 text-sm font-semibold text-brand-green">
            <T en="Email verified. Your account can now safely link matching guest orders." ne="इमेल पक्का भयो। पहिलेका अर्डर पनि यही खातामा जोडिन्छन्।" />
          </p>
        ) : null}
        {resolvedSearchParams?.session === "ended" ? (
          <p className="mb-6 rounded-lg bg-brand-green-mist p-4 text-sm font-semibold text-brand-green">
            <T en="All customer sessions have been signed out." ne="सबै यन्त्रबाट लगआउट भयो।" />
          </p>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Linked orders" value={orders.length} detail="account history" />
          <StatCard label="Open orders" value={openOrders.length} detail="new or contacted" />
          <StatCard label="Payment review" value={pendingPayments.length} detail="unpaid or pending" />
          <StatCard
            label="Latest order"
            value={latestOrder ? formatDate(latestOrder.createdAt) : "-"}
            detail={latestOrder?.id ?? "no order"}
          />
        </div>

        {referral ? <ReferralCard summary={referral} shopUrl={absoluteUrl("/shop")} /> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6">
            <ProfileEditForm user={user} />
            <PasswordChangeForm />
          </div>
          <div className="grid content-start gap-6">
            <EmailVerificationPanel user={user} />
            <OrderClaimForm />
            <aside className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-brand-green-ink">
                <T en="Account status" ne="खाताको अवस्था" />
              </h2>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="font-semibold text-brand-muted"><T en="Email" ne="इमेल" /></dt>
                  <dd className="mt-1 font-bold text-brand-green-ink">{user.email}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-brand-muted"><T en="Member since" ne="कहिलेदेखि" /></dt>
                  <dd className="mt-1 font-bold text-brand-green-ink">
                    {formatAdminDate(user.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-brand-muted"><T en="Password updated" ne="पासवर्ड फेरिएको" /></dt>
                  <dd className="mt-1 font-bold text-brand-green-ink">
                    {user.passwordUpdatedAt ? formatDate(user.passwordUpdatedAt) : "-"}
                  </dd>
                </div>
              </dl>
              <form action={logoutAllCustomerSessionsAction} className="mt-5">
                <button
                  type="submit"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-brand-clay/30 bg-white px-4 text-sm font-bold text-brand-clay transition hover:bg-brand-clay-mist"
                >
                  <T en="Sign out all devices" ne="सबै यन्त्रबाट लगआउट" />
                </button>
              </form>
            </aside>
          </div>
        </div>

        <OrderHistory orders={orders} />
      </section>
      <Footer />
    </main>
  );
}
