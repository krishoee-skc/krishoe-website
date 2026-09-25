"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import {
  rateForChannel,
  sizeChoices,
  wholesaleSet,
  type CartLine,
  type SellableItem,
} from "@/app/admin/pos/_components/pos-bill-rules";

type PosSizeSheetProps = {
  item: SellableItem;
  cart: CartLine[];
  channel: string;
  /** A return takes a pair back, so every size can be pressed. */
  returning?: boolean;
  onPick: (size: string, color: string) => void;
  onPickSet: (sizes: string[], color: string) => void;
  onClose: () => void;
};

/**
 * The shoe's sizes as buttons, and its colours when it has more than one.
 *
 * Opens from the bottom on a phone, where the thumb already is, and in the
 * middle on a computer. The keys 1–9 press the first nine sizes, so a counter
 * with a keyboard never reaches for the mouse. A size with nothing left is
 * shown struck through rather than hidden, so "no 43" is an answer and not a
 * missing button.
 */
export default function PosSizeSheet({
  item,
  cart,
  channel,
  returning = false,
  onPick,
  onPickSet,
  onClose,
}: PosSizeSheetProps) {
  const { text } = useLanguage();
  const colors = (item.colors ?? []).filter(Boolean);
  const [color, setColor] = useState(colors[0] ?? "");
  const choices = returning
    ? sizeChoices(item, []).map((choice) => ({ ...choice, sellable: true }))
    : sizeChoices(item, cart);
  const setSizes = channel === "Wholesale" && !returning ? wholesaleSet(item, cart) : [];
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const choice = choices[Number(event.key) - 1];
        if (choice?.sellable) {
          event.preventDefault();
          onPick(choice.size, color);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, color, onClose, onPick]);

  const firstSellable = choices.findIndex((choice) => choice.sellable);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-brand-green-ink/50 p-0 md:items-center md:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-size-title"
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-brand-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:max-w-md md:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-brand-green-line md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="pos-size-title" className="text-lg font-black text-brand-green-ink">
              {item.design}
            </h3>
            <p className="text-sm text-brand-muted">
              {item.sku ? `${item.sku} · ` : ""}
              {money(rateForChannel(channel, item))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={text("Close", "बन्द गर्ने")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brand-green-line text-xl text-brand-muted"
          >
            ×
          </button>
        </div>

        {colors.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={text("Colour", "रङ")}>
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={`min-h-10 rounded-full border-2 px-4 text-sm font-bold ${
                  color === option
                    ? "border-brand-green bg-brand-green-tint text-brand-green"
                    : "border-brand-green-line bg-brand-paper-deep text-brand-green-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {choices.map((choice, index) => {
            return (
              <button
                key={choice.size}
                ref={index === firstSellable ? firstRef : undefined}
                type="button"
                disabled={!choice.sellable}
                onClick={() => onPick(choice.size, color)}
                className="relative flex h-16 flex-col items-center justify-center rounded-2xl border-2 border-brand-green-line bg-brand-paper-deep transition hover:border-brand-green focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through"
              >
                {index < 9 ? (
                  <span className="absolute left-1.5 top-1 hidden font-mono text-[10px] text-brand-muted md:block" aria-hidden="true">
                    {index + 1}
                  </span>
                ) : null}
                <span className="text-xl font-black tabular-nums text-brand-green-ink">{choice.size}</span>
                <span className="text-[11px] font-semibold text-brand-muted">
                  {returning
                    ? text("back", "फिर्ता")
                    : !choice.sellable
                    ? text("none left", "सकियो")
                    : choice.left === null
                      ? text("not counted", "नगनिएको")
                      : text(`${choice.left} left`, `${choice.left} बाँकी`)}
                </span>
              </button>
            );
          })}
        </div>

        {!returning && choices.some((choice) => choice.sellable && choice.left === null) ? (
          <p className="mt-3 text-xs text-brand-muted">
            {text(
              "“Not counted”: this shoe's stock was entered as one mixed pile, so the pairs of each size are not known. The sale draws from that pile.",
              "“नगनिएको”: यो जुत्ताको stock साइज छुट्याएर होइन, एउटै थुप्रोमा राखिएको छ, त्यसैले हरेक साइजमा कति छ थाहा छैन। बिक्री त्यही थुप्रोबाट घट्छ।",
            )}
          </p>
        ) : null}

        {setSizes.length > 1 ? (
          <button
            type="button"
            onClick={() => onPickSet(setSizes, color)}
            className="mt-4 min-h-12 w-full rounded-2xl border-2 border-dashed border-brand-gold bg-brand-cream-soft px-4 text-sm font-black text-brand-gold-deep"
          >
            {text(
              `Add a full set: ${setSizes[0]}–${setSizes[setSizes.length - 1]}, one pair each (${setSizes.length} pairs)`,
              `पूरा सेट थप्ने: ${setSizes[0]}–${setSizes[setSizes.length - 1]}, हरेक साइज १ जोडा (${setSizes.length} जोडा)`,
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
