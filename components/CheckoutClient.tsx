"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { paymentOptions, shippingOptions, whatsappOrderUrl } from "@/lib/commerce";
import { paymentOptionLabel, shippingOptionLabel } from "@/lib/commerce-labels";
import { useLanguage } from "@/components/LanguageProvider";
import { formatPrice } from "@/lib/products";
import { describeStockShortfalls, type StockShortfall } from "@/lib/order-stock";
import { submitCheckout, type FormState } from "@/app/actions";
import type { SafeUser } from "@/lib/user-store";
import { ArrowRightIcon, CheckIcon } from "@/components/Icons";
import OrderSummary from "@/components/OrderSummary";
import PaymentInstructions from "@/components/PaymentInstructions";
import SubmitButton from "@/components/SubmitButton";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { rememberCheckoutAttemptAction } from "@/app/checkout/actions";
import { trackCommerceEvent } from "@/lib/analytics-events";

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
  const { text, language } = useLanguage();
  const nepali = language === "ne";
  const steps = [
    text("Details", "विवरण"),
    text("Delivery", "डेलिभरी"),
    text("Confirm", "पुष्टि"),
  ];

  function rememberAttempt(form: HTMLFormElement | null) {
    if (!form) return;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    if (!email.includes("@")) return;

    // Deliberately not awaited. A shopper waiting on a background note would be
    // a shopper waiting for nothing.
    void rememberCheckoutAttemptAction(data);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <input type="hidden" name="order" value={orderItemsForDb} />
        <input type="hidden" name="total" value={subtotalLabel} />
        {/* Structured items let the server recompute the total from catalog
            prices — the submitted total above is never trusted. */}
        <input type="hidden" name="items" value={itemsJson} />
        {/* The language the customer is reading the shop in, carried with the
            order so the confirmation email arrives in it. The choice lives in
            the browser's storage, which no server can see — if it is not sent
            here, the shop has no way of knowing and everyone gets Nepali. */}
        <input type="hidden" name="language" value={language} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
              {text("Customer details", "ग्राहक विवरण")}
            </p>
            <h2 className="mt-3 text-2xl font-black text-brand-green-ink md:text-3xl">
              {text("Delivery request", "डेलिभरी अनुरोध")}
            </h2>
          </div>
          <div className="flex gap-1.5">
            {steps.map((step, index) => (
              <span
                key={step}
                className="inline-flex min-h-8 items-center rounded-full border border-brand-green/20 bg-brand-mist px-3 text-xs font-black text-brand-green-ink"
              >
                {index + 1}. {step}
              </span>
            ))}
          </div>
        </div>

        <div
          className={`mt-5 rounded-lg border p-4 text-sm font-semibold ${
            user
              ? "border-brand-green/20 bg-brand-green-mist text-brand-green"
              : "border-brand-gold-bright/40 bg-brand-cream-soft text-brand-gold-ink"
          }`}
        >
          {user
            ? text(
                "Signed in. Saved details are filled where available.",
                "साइन इन हुनुभएको छ। सुरक्षित विवरण आफै भरिएको छ।",
              )
            : text(
                "Sign in or create an account after ordering to save details for next time.",
                "अर्डरपछि खाता बनाउनुहोस् — अर्को पटक विवरण आफै भरिन्छ।",
              )}
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            {text("Full name", "पूरा नाम")}
            <input
              name="name"
              defaultValue={user?.name}
              required
              maxLength={80}
              autoComplete="name"
              className="min-h-14 rounded-lg border border-black/10 px-4 py-2 font-normal outline-none focus:border-brand-green md:h-12 md:py-0"
              placeholder={text("Your name", "तपाईंको नाम")}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            {text("Phone", "फोन नम्बर")}
            <input
              name="phone"
              type="tel"
              defaultValue={user?.phone}
              required
              maxLength={20}
              pattern="^\+?[0-9\s().-]{7,20}$"
              autoComplete="tel"
              className="min-h-14 rounded-lg border border-black/10 px-4 py-2 font-normal outline-none focus:border-brand-green md:h-12 md:py-0"
              placeholder="+977..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink md:col-span-2">
            {text("Email for confirmation", "पुष्टिका लागि इमेल")}
            {/* On blur, not on every keystroke: the moment the shopper has
                finished giving an address is the moment the shop can write to
                them if they walk away. Nothing is created here — no order, no
                held stock — and a failure is silent, because a background
                note-to-self must never interrupt a purchase. */}
            <input
              name="email"
              defaultValue={user?.email}
              type="email"
              maxLength={120}
              autoComplete="email"
              onBlur={(event) => rememberAttempt(event.currentTarget.form)}
              className="min-h-14 rounded-lg border border-black/10 px-4 py-2 font-normal outline-none focus:border-brand-green md:h-12 md:py-0"
              placeholder="you@example.com"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink md:col-span-2">
            {text("Delivery address", "डेलिभरी ठेगाना")}
            <textarea
              name="address"
              defaultValue={user?.address}
              required
              rows={4}
              maxLength={600}
              autoComplete="street-address"
              className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
              placeholder={text("City, area, landmark", "सहर, टोल, नजिकको चिनारी")}
            />
          </label>
          {/* Optional, and small. A discount box shouted at every customer
              teaches them all to go looking for a code before they buy. */}
          <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
            {text("Discount code (if you have one)", "छुटको कोड (भए मात्र)")}
            <input
              name="couponCode"
              maxLength={24}
              autoComplete="off"
              autoCapitalize="characters"
              className="rounded-lg border border-black/10 px-4 py-3 font-normal uppercase tracking-[0.12em] outline-none focus:border-brand-green"
              placeholder={text("e.g. DASHAIN10", "जस्तै DASHAIN10")}
            />
          </label>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-brand-green-ink">
              {text("Delivery option", "डेलिभरी विकल्प")}
            </p>
            <div className="mt-3 grid gap-2">
              {shippingOptions.map((option, index) => (
                <label
                  key={option}
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-black/10 p-3 text-sm font-semibold text-brand-muted transition has-[:checked]:border-brand-green has-[:checked]:bg-brand-green-mist has-[:checked]:text-brand-green-ink"
                >
                  {/* value stays English — the server validates against it */}
                  <input className="accent-brand-green" type="radio" name="delivery" value={option} defaultChecked={index === 0} />
                  {shippingOptionLabel(option, nepali)}
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-brand-mist px-3 py-2 text-xs font-semibold leading-5 text-brand-muted">
              {text(
                "Delivery charge is not included in the product total. KRISHOE confirms the exact fee from your location before dispatch; store pickup has no delivery fee.",
                "डेलिभरी शुल्क सामानको मूल्यमा समावेश छैन। पठाउनुअघि KRISHOE ले तपाईंको ठाउँअनुसार शुल्क पक्का गरेर बताउँछ; पसलमै आएर लिँदा शुल्क लाग्दैन।",
              )}
            </p>
            {/* Someone choosing to fetch it themselves needs the hours before
                they set out, not after. Monday especially — a closed shutter
                after a journey is the kind of thing a customer tells people
                about. */}
            <p className="mt-2 rounded-lg border border-brand-gold/40 bg-brand-mist px-3 py-2 text-xs font-semibold leading-5 text-brand-green-ink">
              {text(
                "Store pickup: open 8 AM – 6 PM. Closed every Monday.",
                "पसलमै आएर लिने: बिहान ८ बजे – साँझ ६ बजे। हरेक सोमबार बन्द।",
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-green-ink">
              {text("Payment option", "भुक्तानी विकल्प")}
            </p>
            <div className="mt-3 grid gap-2">
              {paymentOptions.map((option, index) => (
                <label
                  key={option}
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-black/10 p-3 text-sm font-semibold text-brand-muted transition has-[:checked]:border-brand-green has-[:checked]:bg-brand-green-mist has-[:checked]:text-brand-green-ink"
                >
                  {/* value stays English — it is stored on the order record */}
                  <input className="accent-brand-green" type="radio" name="payment" value={option} defaultChecked={index === 0} />
                  {paymentOptionLabel(option, nepali)}
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-brand-mist px-3 py-2 text-xs font-semibold leading-5 text-brand-muted">
              {text(
                "Digital payment is requested only after KRISHOE confirms stock and delivery.",
                "स्टक र डेलिभरी पक्का भएपछि मात्र अनलाइन भुक्तानी मागिन्छ।",
              )}
            </p>
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
                {text("Update your cart", "कार्ट मिलाउनुहोस्")}
              </Link>{" "}
              {text("to continue.", "अनि अगाडि बढ्नुहोस्।")}
            </p>
          ) : null}
          <SubmitButton
            idleLabel={
              isPending
                ? text("Sending request", "अनुरोध पठाइँदै")
                : text("Submit order request", "अर्डर अनुरोध पठाउनुहोस्")
            }
            pendingLabel={text("Sending request", "अनुरोध पठाइँदै")}
            disabled={isPending || stockShortfalls.length > 0}
          />
          <a
            href={whatsappOrderUrl(whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-brand-green px-6 text-sm font-black text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            {text("Send details on WhatsApp", "WhatsApp मा विवरण पठाउनुहोस्")}
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
  const { text } = useLanguage();
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
          {text("Order saved", "अर्डर सुरक्षित भयो")}
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-5xl">
          {text("Request received.", "अनुरोध प्राप्त भयो।")}
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-brand-muted">
          {message}
        </p>

        <div className="mt-7 grid gap-3 rounded-lg border border-black/10 bg-brand-mist p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-brand-muted">{text("Reference", "अर्डर नम्बर")}</span>
            <span className="font-mono text-sm font-black text-brand-green-ink">
              {submittedOrder.reference}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-brand-muted">{text("Estimated total", "अनुमानित कुल")}</span>
            <span className="text-lg font-black text-brand-green">{submittedOrder.total}</span>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={orderPath}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            {text("View order status", "अर्डरको अवस्था हेर्नुहोस्")}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href={accountPath}
            className="inline-flex h-12 items-center rounded-full border border-brand-green px-6 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            {user ? text("My account", "मेरो खाता") : text("Create account", "खाता बनाउनुहोस्")}
          </Link>
          <a
            href={whatsappOrderUrl(submittedOrder.whatsappMessage)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center rounded-full border border-black/10 px-6 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            {text("WhatsApp confirm", "WhatsApp मा पुष्टि")}
          </a>
        </div>
      </section>

      <aside className="h-fit rounded-lg border border-black/10 bg-brand-green-ink p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
          {text("Next step", "अबको चरण")}
        </p>
        <p className="mt-4 text-sm leading-7 text-white/70">
          {text(
            "KRISHOE will confirm stock, delivery timing, and final payment before dispatch.",
            "पठाउनुअघि KRISHOE ले स्टक, डेलिभरीको समय र अन्तिम भुक्तानी पक्का गर्नेछ।",
          )}
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-white"
        >
          {text("Continue shopping", "किनमेल जारी राख्नुहोस्")}
        </Link>
      </aside>
    </div>
  );
}

type CheckoutClientProps = {
  user?: SafeUser | null;
};

export default function CheckoutClient({ user = null }: CheckoutClientProps) {
  const { text } = useLanguage();
  const { cartItems, subtotal, subtotalLabel, clearCart, stockShortfalls } = useCommerce();
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
        cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
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
    trackCommerceEvent("begin_checkout");
    const submittedTotal = subtotalLabel;
    const submittedWhatsappMessage = whatsappMessage;

    try {
      const result = await submitCheckout(state, new FormData(event.currentTarget));
      setState(result);

      if (result.ok && result.reference) {
        trackCommerceEvent("purchase", {
          id: result.reference,
          name: "KRISHOE order",
          pricePaisa: subtotal,
          quantity: 1,
        });
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
      <div className="rounded-lg border border-black/10 bg-white p-8 text-center shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          {text("Empty checkout", "कार्ट खाली छ")}
        </p>
        <h1 className="mt-3 text-3xl font-black text-brand-green-ink md:text-4xl">
          {text("Checkout needs a cart.", "अर्डर गर्न कार्टमा सामान चाहिन्छ।")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          {text(
            "Add a KRISHOE pair first, then continue into checkout.",
            "पहिले KRISHOE को एक जोडी थप्नुहोस्, अनि अर्डर अगाडि बढाउनुहोस्।",
          )}
        </p>
        <div className="mx-auto mt-6 grid max-w-2xl gap-2 text-left sm:grid-cols-3">
          {[
            text("Choose a pair", "जोडी छान्नुहोस्"),
            text("Add size and color", "साइज र रङ छान्नुहोस्"),
            text("Confirm request", "अनुरोध पुष्टि गर्नुहोस्"),
          ].map((item, index) => (
            <div key={item} className="rounded-lg border border-brand-green/10 bg-brand-mist px-4 py-3 text-sm font-bold text-brand-green-ink">
              {index + 1}. {item}
            </div>
          ))}
        </div>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          {text("Shop collection", "सङ्ग्रह हेर्नुहोस्")}
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
