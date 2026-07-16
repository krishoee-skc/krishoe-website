"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { paymentOptions, shippingOptions, whatsappOrderUrl } from "@/lib/commerce";
import { formatPrice } from "@/lib/products";
import { describeStockShortfalls, type StockShortfall } from "@/lib/order-stock";
import { submitCheckout, type FormState } from "@/app/actions";
import type { SafeUser } from "@/lib/user-store";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import OrderSummary from "@/components/OrderSummary";
import PaymentInstructions from "@/components/PaymentInstructions";
import SubmitButton from "@/components/SubmitButton";
import { useCommerce } from "@/components/commerce/CommerceProvider";

const initialState: FormState = {
  ok: false,
  message: "",
};

type SubmittedOrder = {
  reference: string;
  total: string;
  whatsappMessage: string;
};

type CheckoutFormProps = {
  user: SafeUser | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  state: FormState;
  isPending: boolean;
  whatsappMessage: string;
  orderItemsForDb: string;
  subtotalLabel: string;
  itemsJson: string;
  stockShortfalls: StockShortfall[];
};

function CheckoutForm({
  user,
  onSubmit,
  state,
  isPending,
  whatsappMessage,
  orderItemsForDb,
  subtotalLabel,
  itemsJson,
  stockShortfalls,
}: CheckoutFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <input type="hidden" name="order" value={orderItemsForDb} />
        <input type="hidden" name="total" value={subtotalLabel} />
        {/* Structured items let the server recompute the total from catalog
            prices — the submitted total above is never trusted. */}
        <input type="hidden" name="items" value={itemsJson} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Customer details</p>
          <h2 className="mt-3 text-3xl font-black text-brand-green-ink">Delivery request</h2>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            Full name
            <input
              name="name"
              defaultValue={user?.name}
              required
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
              placeholder="Your name"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            Phone
            <input
              name="phone"
              type="tel"
              defaultValue={user?.phone}
              required
              maxLength={20}
              pattern="^\+?[0-9\s().-]{7,20}$"
              autoComplete="tel"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
              placeholder="+977..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink md:col-span-2">
            Email for confirmation
            <input
              name="email"
              defaultValue={user?.email}
              type="email"
              maxLength={120}
              autoComplete="email"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink md:col-span-2">
            Delivery address
            <textarea
              name="address"
              defaultValue={user?.address}
              required
              rows={4}
              maxLength={600}
              autoComplete="street-address"
              className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
              placeholder="City, area, landmark"
            />
          </label>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-brand-green-ink">Delivery option</p>
            <div className="mt-3 grid gap-2">
              {shippingOptions.map((option, index) => (
                <label key={option} className="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm text-brand-muted">
                  <input type="radio" name="delivery" value={option} defaultChecked={index === 0} />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-green-ink">Payment option</p>
            <div className="mt-3 grid gap-2">
              {paymentOptions.map((option, index) => (
                <label key={option} className="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm text-brand-muted">
                  <input type="radio" name="payment" value={option} defaultChecked={index === 0} />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          {stockShortfalls.length > 0 ? (
            <p
              role="status"
              className="rounded-lg bg-brand-clay-mist px-4 py-3 text-sm font-semibold leading-6 text-brand-clay"
            >
              {describeStockShortfalls(stockShortfalls)}.{" "}
              <Link href="/cart" className="underline">
                Update your cart
              </Link>{" "}
              to continue.
            </p>
          ) : null}
          <SubmitButton
            idleLabel={isPending ? "Sending request" : "Submit order request"}
            pendingLabel="Sending request"
            disabled={isPending || stockShortfalls.length > 0}
          />
          <a
            href={whatsappOrderUrl(whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-brand-green px-6 text-sm font-black text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            Confirm on WhatsApp
          </a>
          {state.message ? (
            <p
              aria-live="polite"
              className={`rounded-lg p-4 text-sm font-semibold ${
                state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-mist text-brand-clay"
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function CheckoutSuccess({
  user,
  submittedOrder,
  message,
}: {
  user: SafeUser | null;
  submittedOrder: SubmittedOrder;
  message: string;
}) {
  const orderPath = `/order/${submittedOrder.reference}`;
  const accountPath = user
    ? "/account"
    : `/account/register?next=${encodeURIComponent(orderPath)}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)] md:p-8">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-green-mist text-brand-green">
          <CheckIcon className="h-7 w-7" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          Order saved
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          Request received.
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-brand-muted">
          {message}
        </p>

        <div className="mt-7 grid gap-3 rounded-lg border border-black/10 bg-brand-mist p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-brand-muted">Reference</span>
            <span className="font-mono text-sm font-black text-brand-green-ink">
              {submittedOrder.reference}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-brand-muted">Estimated total</span>
            <span className="text-lg font-black text-brand-green">{submittedOrder.total}</span>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={orderPath}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            View order status
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href={accountPath}
            className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            {user ? "My account" : "Create account"}
          </Link>
          <a
            href={whatsappOrderUrl(submittedOrder.whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            WhatsApp confirm
          </a>
        </div>
      </section>

      <aside className="h-fit rounded-lg border border-black/10 bg-brand-green-ink p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
          Next step
        </p>
        <p className="mt-4 text-sm leading-7 text-white/70">
          KRISHOE will confirm stock, delivery timing, and final payment before dispatch.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-white"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}

type CheckoutClientProps = {
  user?: SafeUser | null;
};

export default function CheckoutClient({ user = null }: CheckoutClientProps) {
  const { cartItems, subtotalLabel, clearCart, stockShortfalls } = useCommerce();
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);

  const orderItemsForDb = useMemo(
    () =>
      cartItems
        .map(
          (item, index) =>
            `${index + 1}. ${item.name} (${item.productId})\n` +
            `   Size: ${item.size} / Color: ${item.color} / Qty: ${item.quantity}\n` +
            `   Line total: ${formatPrice(item.lineTotal)}`,
        )
        .join("\n"),
    [cartItems],
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      ),
    [cartItems],
  );

  const whatsappMessage = useMemo(
    () =>
      `Hello KRISHOE, I want to confirm my order. My total is ${subtotalLabel}. Order details: ${orderItemsForDb}`,
    [subtotalLabel, orderItemsForDb],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    const submittedTotal = subtotalLabel;
    const submittedWhatsappMessage = whatsappMessage;

    try {
      const result = await submitCheckout(state, new FormData(event.currentTarget));
      setState(result);

      if (result.ok && result.reference) {
        setSubmittedOrder({
          reference: result.reference,
          total: result.total ?? submittedTotal,
          whatsappMessage: submittedWhatsappMessage,
        });
        clearCart();
      }
    } finally {
      setIsPending(false);
    }
  }

  if (submittedOrder) {
    return <CheckoutSuccess user={user} submittedOrder={submittedOrder} message={state.message} />;
  }

  if (cartItems.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-10 text-center">
        <h1 className="text-4xl font-black text-brand-green-ink">Checkout needs a cart.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          Add a KRISHOE pair first, then continue into checkout.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          Shop collection
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        <CheckoutForm
          user={user}
          onSubmit={handleSubmit}
          state={state}
          isPending={isPending}
          stockShortfalls={stockShortfalls}
          whatsappMessage={whatsappMessage}
          orderItemsForDb={orderItemsForDb}
          subtotalLabel={subtotalLabel}
          itemsJson={itemsJson}
        />
        <PaymentInstructions />
      </div>
      <OrderSummary />
    </div>
  );
}
