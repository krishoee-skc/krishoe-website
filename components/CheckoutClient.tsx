"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { paymentOptions, shippingOptions, whatsappOrderUrl } from "@/lib/commerce";
import { formatPrice } from "@/lib/products";
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
};

function CheckoutForm({
  user,
  onSubmit,
  state,
  isPending,
  whatsappMessage,
  orderItemsForDb,
  subtotalLabel,
}: CheckoutFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <input type="hidden" name="order" value={orderItemsForDb} />
        <input type="hidden" name="total" value={subtotalLabel} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">Customer details</p>
          <h2 className="mt-3 text-3xl font-black text-[#10231D]">Delivery request</h2>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
            Full name
            <input
              name="name"
              defaultValue={user?.name}
              required
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
              placeholder="Your name"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
            Phone
            <input
              name="phone"
              type="tel"
              defaultValue={user?.phone}
              required
              maxLength={20}
              pattern="^\+?[0-9\s().-]{7,20}$"
              autoComplete="tel"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
              placeholder="+977..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#10231D] md:col-span-2">
            Email for confirmation
            <input
              name="email"
              defaultValue={user?.email}
              type="email"
              maxLength={120}
              autoComplete="email"
              className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#10231D] md:col-span-2">
            Delivery address
            <textarea
              name="address"
              defaultValue={user?.address}
              required
              rows={4}
              maxLength={600}
              autoComplete="street-address"
              className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-[#0B4D3B]"
              placeholder="City, area, landmark"
            />
          </label>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-[#10231D]">Delivery option</p>
            <div className="mt-3 grid gap-2">
              {shippingOptions.map((option, index) => (
                <label key={option} className="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm text-[#5F6B66]">
                  <input type="radio" name="delivery" value={option} defaultChecked={index === 0} />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-[#10231D]">Payment option</p>
            <div className="mt-3 grid gap-2">
              {paymentOptions.map((option, index) => (
                <label key={option} className="flex items-center gap-3 rounded-lg border border-black/10 p-3 text-sm text-[#5F6B66]">
                  <input type="radio" name="payment" value={option} defaultChecked={index === 0} />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          <SubmitButton
            idleLabel={isPending ? "Sending request" : "Submit order request"}
            pendingLabel="Sending request"
            disabled={isPending}
          />
          <a
            href={whatsappOrderUrl(whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[#0B4D3B] px-6 text-sm font-black text-[#0B4D3B] transition hover:bg-[#0B4D3B] hover:text-white"
          >
            Confirm on WhatsApp
          </a>
          {state.message ? (
            <p
              aria-live="polite"
              className={`rounded-lg p-4 text-sm font-semibold ${
                state.ok ? "bg-[#E9F2EE] text-[#0B4D3B]" : "bg-[#FFF1EF] text-[#7B3128]"
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
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#E9F2EE] text-[#0B4D3B]">
          <CheckIcon className="h-7 w-7" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
          Order saved
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-5xl">
          Request received.
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#5F6B66]">
          {message}
        </p>

        <div className="mt-7 grid gap-3 rounded-lg border border-black/10 bg-[#F5F7F4] p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-[#5F6B66]">Reference</span>
            <span className="font-mono text-sm font-black text-[#10231D]">
              {submittedOrder.reference}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-[#5F6B66]">Estimated total</span>
            <span className="text-lg font-black text-[#0B4D3B]">{submittedOrder.total}</span>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={orderPath}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
          >
            View order status
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href={accountPath}
            className="inline-flex h-12 items-center rounded-full border border-[#0B4D3B] px-6 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
          >
            {user ? "My account" : "Create account"}
          </Link>
          <a
            href={whatsappOrderUrl(submittedOrder.whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-bold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
          >
            WhatsApp confirm
          </a>
        </div>
      </section>

      <aside className="h-fit rounded-lg border border-black/10 bg-[#10231D] p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#D4AF37]">
          Next step
        </p>
        <p className="mt-4 text-sm leading-7 text-white/70">
          KRISHOE will confirm stock, delivery timing, and final payment before dispatch.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#D4AF37] px-6 text-sm font-black text-[#10231D] transition hover:bg-white"
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
  const { cartItems, subtotalLabel, clearCart } = useCommerce();
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
          total: submittedTotal,
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
        <h1 className="text-4xl font-black text-[#10231D]">Checkout needs a cart.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#5F6B66]">
          Add a KRISHOE pair first, then continue into checkout.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
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
          whatsappMessage={whatsappMessage}
          orderItemsForDb={orderItemsForDb}
          subtotalLabel={subtotalLabel}
        />
        <PaymentInstructions />
      </div>
      <OrderSummary />
    </div>
  );
}
