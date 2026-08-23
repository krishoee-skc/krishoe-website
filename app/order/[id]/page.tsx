import type { Metadata } from "next";
import T from "@/components/T";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShareShop from "@/components/ShareShop";
import { absoluteUrl } from "@/lib/seo";
import OnlinePaymentButtons from "@/components/payments/OnlinePaymentButtons";
import PendingPaymentStatus from "@/components/payments/PendingPaymentStatus";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getGatewayConfig, type GatewayProvider } from "@/lib/payment-gateways";
import { getProducts } from "@/lib/product-store";
import { reportError } from "@/lib/report-error";
import { getOrderById, orderMatchesCustomer, type OrderItem, type OrderStatus } from "@/lib/submissions";

type OrderStatusPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ payment?: string }>;
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

/**
 * The pairs from this order that this customer can still review.
 *
 * Mirrors the rules submitReview enforces, so the invitation never promises
 * something the server would refuse: the order must be Closed, the product must
 * still exist, and a customer gets one review per product. Deduplicated by
 * product because the same style in two sizes is two order lines but one thing
 * to write about.
 *
 * A failure here must not take down the order page — a shopper checking their
 * order cares about the order, not the review prompt — so the caller reports
 * the error and renders nothing.
 */
async function reviewablePairs(items: OrderItem[], customerId: string) {
  const wanted = new Set(items.filter((item) => item.quantity > 0).map((item) => item.productId));
  if (wanted.size === 0) return [];

  const products = await getProducts();

  return products
    .filter((product) => wanted.has(product.id))
    .filter((product) => !product.reviews.some((review) => review.customerUserId === customerId))
    .map((product) => ({ id: product.id, name: product.name }));
}

const statusCopy: Record<OrderStatus, string> = {
  New: "KRISHOE has received this request.",
  Contacted: "KRISHOE has contacted the customer for confirmation.",
  Closed: "This request has been closed.",
  Cancelled: "This request was cancelled and will not be dispatched.",
};

export default async function OrderStatusPage({ params, searchParams }: OrderStatusPageProps) {
  const { id } = await params;
  const { payment } = (await searchParams) ?? {};
  const [order, user] = await Promise.all([getOrderById(id), getCurrentCustomer()]);

  if (!order) {
    notFound();
  }

  const canViewPrivateDetails = user ? orderMatchesCustomer(order, user) : false;
  const loginPath = `/account/login?next=${encodeURIComponent(`/order/${order.id}`)}`;
  const registerPath = `/account/register?next=${encodeURIComponent(`/order/${order.id}`)}`;
  const onlinePaymentProviders = (["esewa", "khalti"] as GatewayProvider[]).filter(
    (provider) => getGatewayConfig(provider).enabled,
  );
  const canStartOnlinePayment =
    canViewPrivateDetails &&
    order.status === "Contacted" &&
    (order.paymentStatus === "Unpaid" || order.paymentStatus === "Failed");
  const canInviteReview = canViewPrivateDetails && user && order.status === "Closed";
  const pairsToReview = canInviteReview
    ? await reviewablePairs(order.items, user.id).catch((error) => {
        reportError("load the review invitation for this order", error);
        return [];
      })
    : [];
  const pendingOnlineProvider =
    canViewPrivateDetails &&
    order.paymentStatus === "Pending" &&
    (order.paymentProvider === "esewa" || order.paymentProvider === "khalti") &&
    getGatewayConfig(order.paymentProvider).enabled
      ? order.paymentProvider
      : null;

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

          {payment && canViewPrivateDetails ? (
            <p
              role="status"
              className={`mt-4 rounded-lg p-4 text-sm font-bold ${
                order.paymentStatus === "Paid"
                  ? "bg-brand-green-mist text-brand-green"
                  : order.paymentStatus === "Pending"
                    ? "bg-[#FFF9EA] text-brand-gold-ink"
                    : "bg-brand-clay-mist text-brand-clay"
              }`}
            >
              {order.paymentStatus === "Paid"
                ? "Payment verified successfully. Thank you."
                : order.paymentStatus === "Pending"
                  ? "Payment is still pending provider verification. Please do not pay again."
                  : "Payment was not completed. No verified charge was recorded."}
            </p>
          ) : null}

          {!canViewPrivateDetails ? (
            <div className="mt-6 rounded-lg border border-[#F4DEAE] bg-[#FFF9EA] p-5">
              <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Private details protected" ne="व्यक्तिगत विवरण सुरक्षित" />
                </h2>
              <p className="mt-2 text-sm leading-7 text-brand-muted">
                Customer phone, address, items, total, and payment references are only visible
                from the KRISHOE account that placed this order or has a verified matching email/phone.
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
                  <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Customer" ne="ग्राहक" />
                </h2>
                  <div className="mt-4 grid gap-2 text-sm leading-7 text-brand-muted">
                    <span>{order.name}</span>
                    <span>{order.phone}</span>
                    <span>{order.address}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-black/10 p-5">
                  <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Delivery" ne="डेलिभरी" />
                </h2>
                  <div className="mt-4 grid gap-2 text-sm leading-7 text-brand-muted">
                    <span>{order.delivery}</span>
                    <span>{order.payment}</span>
                    <span className="font-black text-brand-green">{order.total}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-black/10 p-5">
                <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Payment" ne="भुक्तानी" />
                </h2>
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

              {canStartOnlinePayment ? (
                <OnlinePaymentButtons
                  orderId={order.id}
                  providers={onlinePaymentProviders}
                />
              ) : pendingOnlineProvider ? (
                <PendingPaymentStatus orderId={order.id} provider={pendingOnlineProvider} />
              ) : order.status === "New" && order.paymentStatus !== "Paid" ? (
                <div className="mt-5 rounded-lg border border-[#F4DEAE] bg-[#FFF9EA] p-5">
                  <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Payment opens after confirmation" ne="पक्का भएपछि भुक्तानी खुल्छ" />
                </h2>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    KRISHOE will confirm stock and delivery first. When this order becomes Contacted,
                    secure eSewa/Khalti buttons will appear here.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 rounded-lg border border-black/10 p-5">
                <h2 className="text-lg font-black text-brand-green-ink">
                  <T en="Items" ne="सामान" />
                </h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-brand-muted">{order.order}</p>
              </div>

              {pairsToReview.length > 0 ? (
                <div className="mt-5 rounded-lg border border-[#F4DEAE] bg-[#FFF9EA] p-5">
                  <h2 className="text-lg font-black text-brand-green-ink">
                    तपाईंको जोडी कस्तो लाग्यो?
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-brand-muted">
                    तपाईंको अनुभव लेखिदिनुभयो भने अरू ग्राहकलाई छान्न सजिलो हुन्छ।
                    <span className="mt-1 block text-xs text-gray-500">
                      Tell other shoppers how these pairs worked out for you.
                    </span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pairsToReview.map((pair) => (
                      <Link
                        key={pair.id}
                        href={`/product/${pair.id}#reviews`}
                        className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
                      >
                        ⭐ {pair.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
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

        {/* Asked here and nowhere else. Someone looking at their own order is
            the one person on the site who has already decided KRISHOE is worth
            trusting, and in Nepal that recommendation travels further than any
            advertising the shop could buy. Until now the moment passed in
            silence. */}
        <ShareShop url={absoluteUrl("/shop")} />
      </section>
      <Footer />
    </main>
  );
}
