"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";

/**
 * What it comes to: the lines' sum, discount, VAT, the bill total, what was
 * paid, and — the number this whole screen exists to make visible before the
 * bill is saved — what is still owed, with the supplier's account before and
 * after. Then the bill's note and Save.
 *
 * Split out of the purchase form (2026-10-27); what it does is unchanged. The
 * form keeps the figures, the Enter walk and the saving.
 */
export default function PurchaseTotals({
  lineCount,
  subtotal,
  total,
  discount,
  onDiscount,
  tax,
  onTax,
  vatOn,
  onVat,
  vatAmount,
  vatFromLastBill,
  paid,
  due,
  supplier,
  registerBox,
  onBoxKey,
  plainClass,
  saveButton,
  isSaving,
}: {
  lineCount: number;
  subtotal: number;
  total: number;
  discount: string;
  onDiscount: (value: string) => void;
  tax: string;
  onTax: (value: string) => void;
  vatOn: boolean;
  onVat: (on: boolean) => void;
  vatAmount: number;
  /** VAT came on by itself, from this supplier's last bill. */
  vatFromLastBill: boolean;
  paid: number;
  due: number;
  supplier: { supplierName: string; balanceDue: number } | undefined;
  registerBox: (name: "discount" | "tax", element: HTMLInputElement | null) => void;
  onBoxKey: (name: "discount" | "tax", event: KeyboardEvent<HTMLInputElement>) => void;
  plainClass: string;
  saveButton: RefObject<HTMLButtonElement>;
  isSaving: boolean;
}) {
  const { text } = useLanguage();
  return (
    <aside className="grid content-start gap-3 rounded-md border border-brand-green-line bg-brand-mist/40 p-4 xl:sticky xl:top-4">
      <h3 className="text-[1.0625rem] font-black text-brand-green-ink">
        {text("What it comes to", "बिलको हिसाब")}
      </h3>

      <dl className="grid gap-2 border-b border-brand-green-line pb-3 text-base">
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">
            {text(
              `${lineCount} item${lineCount === 1 ? "" : "s"}`,
              `${lineCount} सामान`,
            )}
          </dt>
          <dd className="font-semibold tabular-nums text-brand-green-ink">{money(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-brand-muted">{text("Discount", "छुट")}</dt>
          <dd>
            <input
              name="discount"
              ref={(element) => registerBox("discount", element)}
              enterKeyHint="next"
              onKeyDown={(event) => onBoxKey("discount", event)}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className={`${plainClass} h-11 w-24 text-right text-[0.9375rem] tabular-nums`}
              placeholder="0"
              value={discount}
              onChange={(event) => onDiscount(event.target.value)}
              aria-label={text("Bill discount", "बिलको छुट")}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-brand-muted">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                role="switch"
                checked={vatOn}
                onChange={(event) => onVat(event.target.checked)}
                className="h-4 w-4 accent-brand-green"
              />
              {text("VAT 13%", "VAT १३%")}
            </label>
          </dt>
          <dd>
            <input
              name="tax"
              ref={(element) => registerBox("tax", element)}
              enterKeyHint="next"
              onKeyDown={(event) => onBoxKey("tax", event)}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              className={`${plainClass} h-11 w-24 text-right text-[0.9375rem] tabular-nums ${vatOn ? "bg-brand-mist" : ""}`}
              placeholder="0"
              value={vatOn ? String(vatAmount) : tax}
              readOnly={vatOn}
              onChange={(event) => onTax(event.target.value)}
              aria-label={text("Bill tax", "बिलको कर")}
            />
          </dd>
        </div>
      </dl>
      {vatOn && vatFromLastBill ? (
        <p className="-mt-1 text-[0.8125rem] font-bold text-brand-green">
          {text(
            "On because this supplier's last bill had VAT. Switch off if this one has none.",
            "यो साहुको पछिल्लो बिलमा VAT थियो, त्यसैले आफैँ खुला भयो। यसमा छैन भने बन्द गर्नुहोस्।",
          )}
        </p>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-black text-brand-green-ink">{text("Bill total", "बिल जम्मा")}</span>
        <span className="text-xl font-black tabular-nums text-brand-green-ink">{money(total)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base text-brand-muted">{text("Paid", "तिरेको")}</span>
        <span className="text-base font-bold tabular-nums text-brand-green">{money(paid)}</span>
      </div>

      {/* The number this whole screen exists to make visible before the bill
          is saved, rather than after. */}
      <div
        className={`rounded-md border p-3 ${
          due > 0
            ? "border-brand-clay/40 bg-brand-clay-tint text-brand-clay"
            : "border-brand-green/30 bg-brand-green-wash text-brand-green"
        }`}
      >
        <p className="text-sm font-black">
          {due > 0 ? text("Still owed", "उधारो रहन्छ") : text("Nothing owed", "पूरै तिरियो")}
        </p>
        <p className="mt-1 text-2xl font-black leading-none tabular-nums">{money(due)}</p>
        {supplier ? (
          <p className="mt-2 text-sm font-bold">
            {text(
              `${supplier.supplierName}'s account: ${money(supplier.balanceDue)} → ${money(supplier.balanceDue + due)}`,
              `${supplier.supplierName} को खाता: ${money(supplier.balanceDue)} → ${money(supplier.balanceDue + due)}`,
            )}
          </p>
        ) : null}
      </div>

      <textarea
        name="note"
        className="min-h-20 rounded-md border border-brand-green-line bg-brand-paper px-3 py-2 text-base outline-none focus:border-brand-green"
        placeholder={text(
          "Bill note, vehicle, gate pass, invoice no.",
          "बिलको टिपोट, गाडी, गेट पास, बिल नं.",
        )}
        aria-label={text("Bill note", "बिलको टिपोट")}
      />

      <button
        ref={saveButton}
        type="submit"
        disabled={isSaving}
        className="hidden h-12 w-full rounded-full bg-brand-green px-6 text-base font-black text-white transition hover:bg-brand-green-ink focus-visible:ring-4 focus-visible:ring-brand-gold-bright disabled:cursor-not-allowed disabled:opacity-60 md:block"
      >
        {isSaving ? text("Saving…", "राख्दै…") : text("Save purchase", "बिल राख्ने")}
        <span className="ml-2 text-sm font-semibold opacity-75">Ctrl+S</span>
      </button>
      <p className="text-center text-sm leading-5 text-brand-muted">
        {text(
          "One press files the bill, the stock, the supplier's account and the payment.",
          "एकपटक थिच्दा — बिल, स्टक, साहुको खाता र तिरेको पैसा सबै एकैचोटि।",
        )}
      </p>
    </aside>
  );
}
