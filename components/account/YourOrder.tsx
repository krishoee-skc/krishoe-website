"use client";

import Link from "next/link";
import { trackingStage } from "@/lib/order-stages";
import { useLanguage } from "@/components/LanguageProvider";
import type { OrderStatus } from "@/lib/submissions";

/**
 * The one thing a customer signs in to find out.
 *
 * This page opened with four counting tiles — "Linked orders", "Open orders",
 * "Payment review", "Latest order" — which is the shop's own bookkeeping
 * language pointed at the person who bought a pair of chappal. None of it
 * answers the question they came with, which is always the same question:
 * where are my shoes.
 *
 * So the newest order leads, in the words the tracking page already uses, with
 * the three steps drawn rather than described. The counts still exist below;
 * they are just no longer the first thing a shopper is asked to interpret.
 *
 * A cancelled order gets no progress bar — a row of steps with none of them
 * lit reads as a delay rather than as a decision that was already made.
 */
export default function YourOrder({
  reference,
  status,
  total,
  itemSummary,
}: {
  reference: string;
  status: OrderStatus;
  total: string;
  itemSummary: string;
}) {
  const { text } = useLanguage();
  const stage = trackingStage(status);

  const steps: [string, number][] = [
    [text("Received", "आइपुग्यो"), 1],
    [text("Being prepared", "तयारीमा"), 2],
    [text("Delivered", "पुग्यो"), 3],
  ];

  return (
    <section className="rounded-2xl bg-brand-cream-hero p-6 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold-deep">
        {text("Your order", "तपाईंको अर्डर")}
      </p>
      <h2 className="mt-2 font-display text-2xl font-black leading-snug text-brand-green-ink sm:text-3xl">
        {text(stage.en, stage.ne)}
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">{text(stage.detailEn, stage.detailNe)}</p>

      {stage.step > 0 ? (
        <ol className="mt-6 flex items-center gap-0">
          {steps.map(([label, step], index) => (
            <li key={label} className="flex flex-1 items-center gap-0 last:flex-none">
              <span className="flex flex-col items-center gap-2">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                    stage.step >= step
                      ? "bg-brand-green text-white"
                      : "border border-brand-green-line bg-brand-paper text-brand-muted-soft"
                  }`}
                >
                  {stage.step >= step ? "✓" : step}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] font-bold ${
                    stage.step >= step ? "text-brand-green" : "text-brand-muted-soft"
                  }`}
                >
                  {label}
                </span>
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={`mb-5 h-0.5 flex-1 ${
                    stage.step > step ? "bg-brand-green" : "bg-brand-green-line"
                  }`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-brand-gold/25 pt-5">
        <div className="min-w-0">
          <p className="font-mono text-xs text-brand-muted">{reference}</p>
          {itemSummary ? (
            <p className="mt-1 truncate text-sm text-brand-green-ink">{itemSummary}</p>
          ) : null}
        </div>
        <p className="font-display text-xl font-black text-brand-green-ink">{total}</p>
      </div>

      <Link
        href="/track-order"
        className="mt-5 inline-flex min-h-11 items-center rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
      >
        {text("Track this order", "अर्डर कहाँ पुग्यो हेर्ने")}
      </Link>
    </section>
  );
}
