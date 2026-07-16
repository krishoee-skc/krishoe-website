import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getOrderById, orderMatchesCustomer, type OrderStatus } from "@/lib/submissions";

type OrderStatusPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Order Status | KRISHOE",
  description: "Track a KRISHOE order request status by reference number.",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const statusCopy: Record<OrderStatus, string> = {
  New: "KRISHOE has received this request.",
  Contacted: "KRISHOE has contacted the customer for confirmation.",
  Closed: "This request has been closed.",
  Cancelled: "This request was cancelled and will not be dispatched.",
};

export default async function OrderStatusPage({ params }: OrderStatusPageProps) {
  const { id } = await params;
  const [order, user] = await Promise.all([getOrderById(id), getCurrentCustomer()]);

  if (!order) {
    notFound();
  }

  const canViewPrivateDetails = user ? orderMatchesCustomer(order, user) : false;
  const loginPath = `/account/login?next=${encodeURIComponent(`/order/${order.id}`)}`;
  const registerPath = `/account/register?next=${encodeURIComponent(`/order/${order.id}`)}`;

  return (
    <main className="bg-brand-mist">
      <Navbar isLoggedIn={Boolean(user)} />
      <section className="mx-auto max-w-4xl px-5 py-16 md:px-8">
        <div className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            Order request
          </p>
          <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-brand-green-ink md:text-5xl">
                {order.id}
              </h1>
              <p className="mt-3 text-sm font-semibold text-brand-muted">
                Submitted {formatDate(order.createdAt)}
              </p>
            </div>
            <span className="w-fit rounded-full bg-brand-green-mist px-4 py-2 text-sm font-black text-brand-green">
              {order.status}
            </span>
          </div>

          <p className="mt-6 rounded-lg bg-brand-mist p-4 text-sm font-bold leading-7 text-brand-green-ink">
            {statusCopy[order.status]}
          </p>

          {!canViewPrivateDetails ? (
            <div className="mt-6 rounded-lg border border-[#F4DEAE] bg-[#FFF9EA] p-5">
              <h2 className="text-lg font-black text-brand-green-ink">Private details protected</h2>
              <p className="mt-2 text-sm leading-7 text-brand-muted">
                Customer phone, address, items, total, and payment references are only visible
                from the KRISHOE account linked to this order email or phone number.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={loginPath}
                  className="inline-flex h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
                >
                  Sign in to view details
                </Link>
                <Link
                  href={registerPath}
                  className="inline-flex h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-white"
                >
                  Create account
                </Link>
              </div>
            </div>
          ) : null}

          {canViewPrivateDetails ? (
            <>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="rounded-lg border border-black/10 p-5">
                  <h2 className="text-lg font-black text-brand-green-ink">Customer</h2>
                  <div className="mt-4 grid gap-2 text-sm leading-7 text-brand-muted">
                    <span>{order.name}</span>
                    <span>{order.phone}</span>
                    <span>{order.address}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-black/10 p-5">
                  <h2 className="text-lg font-black text-brand-green-ink">Delivery</h2>
                  <div className="mt-4 grid gap-2 text-sm leading-7 text-brand-muted">
                    <span>{order.delivery}</span>
                    <span>{order.payment}</span>
                    <span className="font-black text-brand-green">{order.total}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-black/10 p-5">
                <h2 className="text-lg font-black text-brand-green-ink">Payment</h2>
                <div className="mt-4 grid gap-2 text-sm leading-7 text-brand-muted md:grid-cols-2">
                  <span>Status: {order.paymentStatus}</span>
                  <span>Provider: {order.paymentProvider.toUpperCase()}</span>
                  {order.paymentReference ? <span>Reference: {order.paymentReference}</span> : null}
                  {order.paymentTransactionId ? (
                    <span>Transaction: {order.paymentTransactionId}</span>
                  ) : null}
                  {order.paymentVerifiedAt ? (
                    <span>Verified: {formatDate(order.paymentVerifiedAt)}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-black/10 p-5">
                <h2 className="text-lg font-black text-brand-green-ink">Items</h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-brand-muted">{order.order}</p>
              </div>
            </>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
            >
              Continue shopping
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-white"
            >
              Contact KRISHOE
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
