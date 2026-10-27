"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import ChequeFields, { type ChequeDetails } from "@/components/admin/ChequeFields";
import type { SupplierPaymentMethod } from "@/lib/purchasing";

/**
 * The four ways a bill gets paid, as four things to press.
 *
 * They were a dropdown at the foot of the form, beside the tax box, which is
 * where the owner stopped noticing them. QR is new: the shop pays suppliers
 * through eSewa and Khalti already and the only place to record it was "Bank".
 */
const METHODS: Array<{
  id: SupplierPaymentMethod;
  ne: string;
  en: string;
  icon: ReactNode;
}> = [
  {
    id: "Cash",
    ne: "नगद",
    en: "Cash",
    icon: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    id: "Credit",
    ne: "उधारो",
    en: "Credit",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </>
    ),
  },
  {
    id: "Cheque",
    ne: "चेक",
    en: "Cheque",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 10h6M7 14h3" />
      </>
    ),
  },
  {
    id: "QR",
    ne: "QR",
    en: "QR",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
      </>
    ),
  },
];

/**
 * How it was paid: the method, what was handed over, its reference, and a
 * cheque's bank and date.
 *
 * Split out of the purchase form (2026-10-27); what it does is unchanged. The
 * form keeps the amounts, the Enter walk and what a method choice implies.
 */
export default function PurchasePayment({
  paymentMethod,
  onChooseMethod,
  paidFull,
  onPaidFull,
  paidText,
  onPaidAmount,
  registerBox,
  onBoxKey,
  plainClass,
  chequeBook,
  chequeDetails,
  onChequeDetails,
}: {
  paymentMethod: SupplierPaymentMethod;
  onChooseMethod: (id: SupplierPaymentMethod) => void;
  paidFull: boolean;
  onPaidFull: () => void;
  /** What the Paid box shows: the total while "Paid in full", else what was typed. */
  paidText: string;
  /** An amount typed, which lets go of "Paid in full". */
  onPaidAmount: (value: string) => void;
  /** Hands a box to the form's Enter walk. */
  registerBox: (name: "paidAmount" | "paymentReference", element: HTMLInputElement | null) => void;
  onBoxKey: (name: "paidAmount" | "paymentReference", event: KeyboardEvent<HTMLInputElement>) => void;
  plainClass: string;
  chequeBook: { ready: boolean; usedBanks: string[]; todayKey: string };
  chequeDetails: ChequeDetails;
  onChequeDetails: (value: ChequeDetails) => void;
}) {
  const { text } = useLanguage();
  const referenceLabel =
    paymentMethod === "QR"
      ? text("Which wallet — eSewa, Khalti, Fonepay", "कुन app — eSewa, Khalti, Fonepay")
      : paymentMethod === "Cheque"
        ? text("Cheque number", "चेक नम्बर")
        : text("Cheque / bank / reference no.", "चेक / बैंक / रेफरेन्स नं.");

  return (
    <section className="rounded-md border border-brand-green/30 p-3 md:p-4">
      <h3 className="text-[1.0625rem] font-black text-brand-green-ink">
        {text("How it was paid", "कसरी तिर्यो")}
      </h3>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {METHODS.map((method) => {
          const on = paymentMethod === method.id;
          return (
            <button
              key={method.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChooseMethod(method.id)}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 transition ${
                on
                  ? "border-2 border-brand-green bg-brand-green-wash text-brand-green"
                  : "border border-brand-green-line bg-brand-paper text-brand-muted hover:border-brand-gold"
              }`}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {method.icon}
              </svg>
              <span className="text-[0.9375rem] font-black">{text(method.en, method.ne)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="purchase-paid"
              className="text-[0.8125rem] font-black uppercase tracking-[0.12em] text-brand-muted-soft"
            >
              {text("Paid now", "कति तिर्यो")}
            </label>
            {paymentMethod !== "Credit" ? (
              <button
                type="button"
                aria-pressed={paidFull}
                onClick={onPaidFull}
                className={`rounded-full border px-3 py-0.5 text-sm font-black ${
                  paidFull ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line text-brand-green-ink"
                }`}
              >
                💵 {text("Paid in full", "पूरै तिरेँ")}
              </button>
            ) : null}
          </div>
          <input
            id="purchase-paid"
            name="paidAmount"
            ref={(element) => registerBox("paidAmount", element)}
            enterKeyHint="next"
            onKeyDown={(event) => onBoxKey("paidAmount", event)}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            disabled={paymentMethod === "Credit"}
            className={`${plainClass} mt-1 w-full text-right text-lg font-black tabular-nums disabled:bg-brand-mist disabled:text-brand-muted-soft`}
            placeholder="0"
            value={paidText}
            onChange={(event) => onPaidAmount(event.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="purchase-reference"
            className="text-[0.8125rem] font-black uppercase tracking-[0.12em] text-brand-muted-soft"
          >
            {referenceLabel}
          </label>
          <input
            id="purchase-reference"
            name="paymentReference"
            ref={(element) => registerBox("paymentReference", element)}
            enterKeyHint="next"
            onKeyDown={(event) => onBoxKey("paymentReference", event)}
            className={`${plainClass} mt-1 w-full`}
            placeholder={
              paymentMethod === "QR" ? "eSewa / Khalti / Fonepay" : text("Reference no.", "रेफरेन्स नं.")
            }
          />
        </div>
      </div>

      {chequeBook.ready && paymentMethod === "Cheque" ? (
        <div className="mt-3">
          <ChequeFields
            direction="out"
            value={chequeDetails}
            onChange={onChequeDetails}
            usedBanks={chequeBook.usedBanks}
            todayKey={chequeBook.todayKey}
            inputClass={`${plainClass} w-full`}
          />
        </div>
      ) : null}

      {paymentMethod === "Credit" ? (
        <p className="mt-2 text-sm text-brand-muted">
          {text(
            "Nothing handed over — the whole bill stays on the supplier's account.",
            "अहिले केही नतिरेको — पूरै बिल साहुको खातामा उधारो रहन्छ।",
          )}
        </p>
      ) : null}
    </section>
  );
}
