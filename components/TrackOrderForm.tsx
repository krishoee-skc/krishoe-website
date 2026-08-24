"use client";

import { useActionState } from "react";
import Link from "next/link";
import { businessContact } from "@/lib/seo";
import { trackingStage } from "@/lib/order-stages";
import { trackOrderAction, type TrackState } from "@/app/track-order/actions";
import { useLanguage } from "@/components/LanguageProvider";
import SubmitButton from "@/components/SubmitButton";

/**
 * Where a customer finds out whether their shoes are coming.
 *
 * Almost every order here is cash on delivery, so the question behind this page
 * is really "will it turn up?" — and the only way to ask it used to be to
 * telephone the shop. Every answer below is followed by something the customer
 * can do next, because a screen that says "not found" and stops is what sends
 * them to the phone anyway.
 *
 * The English half was already written and never shown: trackingStage has
 * carried `en` and `detailEn` all along, and this screen rendered the Nepali
 * whichever language was chosen. Somebody's brother in Qatar, tracking a pair
 * being sent to their mother, pressed EN and got Devanagari.
 */
// A "use server" module may only export async functions, so the starting state
// lives here rather than beside the action.
const initialTrackState: TrackState = { status: "idle" };

export default function TrackOrderForm() {
  const [state, formAction] = useActionState(trackOrderAction, initialTrackState);
  const { text } = useLanguage();
  const stage = state.order ? trackingStage(state.order.status) : null;

  const steps: [string, number][] = [
    [text("Order received", "अर्डर आइपुग्यो"), 1],
    [text("Confirmed, being prepared", "पक्का भयो, तयारीमा"), 2],
    [text("Delivered", "पुग्यो"), 3],
  ];

  return (
    <div className="mx-auto w-full max-w-xl">
      <form action={formAction} className="rounded-2xl border border-black/10 bg-brand-paper p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
          {text("Order number", "अर्डर नम्बर")}
          <span className="text-xs font-semibold text-brand-muted">
            {text(
              "The number shown after ordering, or the one in your email",
              "अर्डर गरेपछि देखिएको वा email मा आएको नम्बर",
            )}
          </span>
          <input
            name="reference"
            required
            autoComplete="off"
            className="h-12 rounded-lg border border-black/15 bg-brand-paper px-4 font-normal text-brand-green-ink outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
            placeholder="KRI-1042"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-bold text-brand-green-ink">
          {text("The mobile number you ordered with", "अर्डरमा दिएको मोबाइल नम्बर")}
          <span className="text-xs font-semibold text-brand-muted">
            {text(
              "So we know the order is yours, and nobody else can look it up",
              "तपाईंकै अर्डर हो भन्ने पक्का गर्न — अरूले हेर्न नपाऊन्",
            )}
          </span>
          {/* type="tel" for the numeric keypad, not type="number": a leading
              zero matters in a phone number and number inputs eat it. */}
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            className="h-12 rounded-lg border border-black/15 bg-brand-paper px-4 font-normal text-brand-green-ink outline-none placeholder:text-brand-muted-soft focus:border-brand-green"
            placeholder="98XXXXXXXX"
          />
        </label>

        <div className="mt-6">
          <SubmitButton
            idleLabel={text("Find my order", "अर्डर खोज्ने")}
            pendingLabel={text("Looking…", "खोज्दैछौँ…")}
          />
        </div>
      </form>

      {state.status === "found" && state.order && stage ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash p-6"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            {text("Order", "अर्डर")} {state.order.reference}
          </p>
          <h2 className="mt-2 text-2xl font-black text-brand-green-ink">
            {text(stage.en, stage.ne)}
          </h2>
          <p className="mt-2 leading-7 text-brand-muted">{text(stage.detailEn, stage.detailNe)}</p>

          {/* Three steps, so "being prepared" reads as progress rather than as
              a word. Cancelled has no step and gets no bar. */}
          {stage.step > 0 ? (
            <ol className="mt-5 grid gap-2">
              {steps.map(([label, step]) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                      stage.step >= step
                        ? "bg-brand-green text-white"
                        : "bg-brand-paper text-brand-muted-soft"
                    }`}
                  >
                    {stage.step >= step ? "✓" : step}
                  </span>
                  <span
                    className={
                      stage.step >= step ? "font-bold text-brand-green-ink" : "text-brand-muted"
                    }
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          <dl className="mt-6 grid gap-2 border-t border-brand-green/15 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-brand-muted">{text("Total", "जम्मा")}</dt>
              <dd className="font-black text-brand-green-ink">{state.order.total}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-brand-muted">{text("Pairs", "जोडी")}</dt>
              <dd className="font-bold text-brand-green-ink">{state.order.itemCount}</dd>
            </div>
          </dl>

          {state.order.items.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-sm text-brand-muted">
              {state.order.items.map((name, index) => (
                <li key={`${name}-${index}`}>• {name}</li>
              ))}
            </ul>
          ) : null}

          <a
            href={`tel:${businessContact.phoneTel}`}
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
          >
            {text("Something to ask? Ring us", "केही सोध्नु छ? फोन गर्नुहोस्")}
          </a>
        </section>
      ) : null}

      {state.status === "not-found" ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-brand-clay/30 bg-brand-clay-mist p-6"
        >
          <h2 className="text-lg font-black text-brand-clay">
            {text("Order not found", "अर्डर भेटिएन")}
          </h2>
          {/* Deliberately one message for "no such order" and for "not yours".
              Separating them would confirm which reference numbers exist. */}
          <p className="mt-2 leading-7 text-brand-green-ink">
            {text(
              "The number or the mobile did not match. Both have to be exactly what you gave when ordering.",
              "नम्बर वा मोबाइल मिलेन। दुवै अर्डर गर्दा दिएकै जस्तै हुनुपर्छ।",
            )}
          </p>
          <p className="mt-3 leading-7 text-brand-muted">
            {text(
              "If it still will not come up, do not worry — ring us and we will look it up for you.",
              "भेटिएन भने चिन्ता नलिनुहोस् — हामीलाई फोन गर्नुहोस्, हामी हेरिदिन्छौँ।",
            )}
          </p>
          <a
            href={`tel:${businessContact.phoneTel}`}
            className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
          >
            {text(`Ring ${businessContact.phoneDisplay}`, `${businessContact.phoneDisplay} मा फोन गर्ने`)}
          </a>
        </section>
      ) : null}

      {state.status === "rate-limited" ? (
        <section
          aria-live="polite"
          className="mt-6 rounded-2xl border border-brand-clay/30 bg-brand-clay-mist p-6"
        >
          <h2 className="text-lg font-black text-brand-clay">
            {text("Too many tries", "धेरै पटक खोजियो")}
          </h2>
          <p className="mt-2 leading-7 text-brand-green-ink">
            {text(
              "Wait a moment and try again. If it is urgent, ring us instead.",
              "एकैछिन पर्खनुहोस्, अनि फेरि प्रयास गर्नुहोस्। हतार छ भने सिधै फोन गर्नुहोस्।",
            )}
          </p>
          <a
            href={`tel:${businessContact.phoneTel}`}
            className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white"
          >
            {businessContact.phoneDisplay}
          </a>
        </section>
      ) : null}

      <p className="mt-6 text-center text-sm text-brand-muted">
        {text("Forgotten your order number?", "अर्डर नम्बर बिर्सनुभयो?")}{" "}
        <Link href="/account" className="font-bold text-brand-green hover:underline">
          {text("Look in your account", "खातामा गएर हेर्नुहोस्")}
        </Link>
      </p>
    </div>
  );
}
