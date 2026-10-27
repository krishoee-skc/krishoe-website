"use client";

import type { RefObject } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";

/** What the last save filed, shown until the next bill is started. */
export type Receipt = {
  /** Empty when the bill named a new supplier; found by name after the save. */
  supplierId: string;
  supplierName: string;
  billNo: string;
  lines: Array<{ name: string; quantity: string; unit: string; rate: string; sizes: string }>;
  total: number;
  paid: number;
  message: string;
  href: string;
  /** The paper-bill photos: being sent, kept, or what went wrong. */
  photos: { sending: boolean; kept: number; problem: string };
};

/**
 * After saving: the bill as filed, then the next one or a print.
 *
 * Split out of the purchase form (2026-10-27); unchanged. The form decides
 * what "same supplier" and "new bill" do.
 */
export default function PurchaseReceipt({
  receipt,
  newBillButton,
  onSameSupplier,
  onNewBill,
}: {
  receipt: Receipt;
  newBillButton: RefObject<HTMLButtonElement>;
  onSameSupplier: () => void;
  onNewBill: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={text("Bill saved", "बिल सेभ भयो")}>
      <div className="grid w-full max-w-md gap-3 rounded-2xl bg-brand-paper p-5 shadow-2xl">
        <h3 className="text-lg font-black text-brand-green-ink">✅ {text("Bill saved", "बिल सेभ भयो")}</h3>
        <p className="text-sm text-brand-muted">{receipt.message}</p>
        <div className="grid gap-1 rounded-lg border border-dashed border-brand-green-line p-3 text-base">
          <p className="font-black text-brand-green-ink">
            {receipt.supplierName}
            {receipt.billNo ? ` · ${text("bill", "बिल नं.")} ${receipt.billNo}` : ""}
          </p>
          {receipt.lines.map((line, index) => (
            <div key={index} className="flex justify-between gap-3 border-b border-dotted border-brand-green-line py-1">
              <span>
                {index + 1}. {line.name}
                <span className="block text-sm text-brand-muted">
                  {line.quantity} {line.unit} × {money(Number(line.rate) || 0)}
                  {line.sizes ? ` · ${line.sizes}` : ""}
                </span>
              </span>
              <span className="font-bold tabular-nums">{money((Number(line.quantity) || 0) * (Number(line.rate) || 0))}</span>
            </div>
          ))}
          <p className="flex justify-between pt-1 font-black">
            <span>{text("Bill total", "बिल जम्मा")}</span>
            <span className="tabular-nums">{money(receipt.total)}</span>
          </p>
          <p className="flex justify-between text-sm text-brand-muted">
            <span>{text("Paid", "तिरेको")}</span>
            <span className="tabular-nums">{money(receipt.paid)}</span>
          </p>
        </div>
        {receipt.photos.sending ? (
          <p className="text-base font-bold text-brand-muted" role="status">📷 {text("Sending the photo…", "फोटो पठाउँदै…")}</p>
        ) : receipt.photos.kept ? (
          <p className="text-base font-bold text-brand-green" role="status">
            📷 {text(`${receipt.photos.kept} photo(s) kept with the bill`, `${receipt.photos.kept} फोटो बिलसँग राखियो`)}
          </p>
        ) : null}
        {receipt.photos.problem ? (
          <p className="text-base font-bold text-brand-clay" role="alert">
            ⚠ {receipt.photos.problem}{" "}
            {text("The bill is saved — add the photo from the bill page.", "बिल सेभ भइसक्यो — फोटो बिलको पेजबाट थप्नुहोस्।")}
          </p>
        ) : null}
        {/* The next bill is often from the same supplier — a second van, a
            second bill book page. One press, and their name is in. */}
        <button
          type="button"
          onClick={onSameSupplier}
          className="h-12 rounded-full border-2 border-brand-green text-base font-black text-brand-green"
        >
          ➕ {text(`Same supplier, next bill — ${receipt.supplierName}`, `उही साहु, नयाँ बिल — ${receipt.supplierName}`)}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            ref={newBillButton}
            type="button"
            onClick={onNewBill}
            className="h-12 rounded-full bg-brand-green text-base font-black text-white"
          >
            ➕ {text("New bill", "नयाँ बिल")}
          </button>
          {receipt.href ? (
            <a
              href={receipt.href}
              className="flex h-12 items-center justify-center rounded-full border border-brand-green-line text-base font-black text-brand-green-ink"
            >
              🖨️ {text("See / print", "हेर्ने / प्रिन्ट")}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
