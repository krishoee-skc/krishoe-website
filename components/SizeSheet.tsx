"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SafeImage from "@/components/SafeImage";
import SizeGuide from "@/components/SizeGuide";
import { ShoppingBagIcon, XIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { trackCommerceEvent } from "@/lib/analytics-events";
import { formatPrice, type Product } from "@/lib/products";

/** A size with this many pairs or fewer says so: "2 left". */
const FEW_LEFT = 2;

/**
 * The sizes a shopper can choose from, and how many pairs each has when the
 * shop keeps this shoe's stock size by size. Without that, every size is open,
 * as on the product page.
 */
export function sizeChoices(product: Pick<Product, "sizes" | "sizeStock">) {
  return product.sizes.map((size) => {
    const pairs = product.sizeStock ? (product.sizeStock[size] ?? 0) : null;
    return { size, soldOut: pairs === 0, few: pairs !== null && pairs > 0 && pairs <= FEW_LEFT ? pairs : null };
  });
}

/** "Added · Doctor Chappal · Size 37, 38" — every size that went in, by name. */
export function addedLine(name: string, sizes: string[]) {
  return { en: `Added · ${name} · Size ${sizes.join(", ")}`, ne: `थपियो · ${name} · साइज ${sizes.join(", ")}` };
}

/**
 * The size sheet a card's bag button opens (owner, 2026-10-02: "I tapped the
 * cart to buy a 38 and could not"). The button used to put the shoe's first
 * size in the cart without asking, so every pair added from a card was a 36.
 *
 * One size or several — a shopper buying for the family, or a shop buying a
 * run, picks 37 and 38 at once and each goes in as its own line of one pair.
 * Nothing goes in until a size is chosen. A size the shelf has none of is
 * struck through and cannot be pressed.
 *
 * A native <dialog>: the card it is opened from lifts on hover with a
 * transform, which would pin anything "fixed" to the card instead of the
 * screen; a modal dialog sits above the whole page, holds the keyboard inside
 * it and closes on Escape.
 */
export default function SizeSheet({ product, open, onClose, onAdded }: { product: Product; open: boolean; onClose: () => void; onAdded: (sizes: string[]) => void }) {
  const { text } = useLanguage();
  const { addToCart, products } = useCommerce();
  const dialog = useRef<HTMLDialogElement>(null);
  // The catalogue in the provider carries the per-size pairs; the card's own
  // copy of the shoe was drawn on the server and may not.
  const live = products.find((item) => item.id === product.id) ?? product;
  const choices = sizeChoices(live);
  const [chosen, setChosen] = useState<string[]>([]);
  const [color, setColor] = useState(live.colors[0] ?? "");

  // The card draws the sheet only while it is open, so each opening starts
  // with nothing chosen.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  const ordered = choices.map((choice) => choice.size).filter((size) => chosen.includes(size));
  const total = formatPrice(live.priceValue * ordered.length);

  function toggle(size: string) {
    setChosen((current) => (current.includes(size) ? current.filter((item) => item !== size) : [...current, size]));
  }

  function add() {
    if (ordered.length === 0) return;
    for (const size of ordered) addToCart({ productId: live.id, size, color, quantity: 1 });
    trackCommerceEvent("add_to_cart", { id: live.id, name: live.name, pricePaisa: live.priceValue * ordered.length });
    onAdded(ordered);
    onClose();
  }

  const label =
    ordered.length === 0
      ? text("Choose a size first", "पहिले साइज छान्नुहोस्")
      : ordered.length === 1
        ? text(`Add size ${ordered[0]} · ${total}`, `साइज ${ordered[0]} थप्ने · ${total}`)
        : text(`Add ${ordered.length} pairs · Size ${ordered.join(", ")} · ${total}`, `${ordered.length} जोडी थप्ने · साइज ${ordered.join(", ")} · ${total}`);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        // A tap on the shade around the sheet closes it.
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={text(`Choose a size of ${live.name}`, `${live.name} को साइज छान्नुहोस्`)}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-brand-paper p-0 text-brand-green-ink shadow-2xl backdrop:bg-brand-green-ink/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="grid gap-4 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-brand-green-line sm:hidden" />
        <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
          <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-brand-mist">
            <SafeImage src={live.image} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{live.name}</p>
            <p className="text-base font-extrabold tabular-nums">{live.price}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={text("Close", "बन्द गर्ने")} className="grid h-10 w-10 place-items-center rounded-full bg-brand-mist text-brand-green-ink">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm font-bold">
            <span>{text("Choose size — one or more", "साइज छान्नुहोस् — एक वा धेरै")}</span>
            <SizeGuide sizes={live.sizes} />
          </div>
          <div className="grid grid-cols-5 gap-2 pb-3">
            {choices.map((choice) => {
              const on = chosen.includes(choice.size);
              return (
                <button
                  key={choice.size}
                  type="button"
                  disabled={choice.soldOut}
                  aria-pressed={choice.soldOut ? undefined : on}
                  aria-label={choice.soldOut ? text(`Size ${choice.size}, sold out`, `साइज ${choice.size}, सकियो`) : text(`Size ${choice.size}`, `साइज ${choice.size}`)}
                  onClick={() => toggle(choice.size)}
                  className={`relative h-12 rounded-xl border-[1.5px] text-base font-bold tabular-nums transition ${
                    choice.soldOut
                      ? "cursor-not-allowed border-brand-green-line bg-brand-mist text-brand-muted line-through"
                      : on
                        ? "border-brand-green-ink bg-brand-green-ink text-white"
                        : "border-brand-green-line bg-brand-paper hover:border-brand-green"
                  }`}
                >
                  {choice.size}
                  {on ? (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-gold text-[11px] text-white">
                      ✓
                    </span>
                  ) : null}
                  {choice.few ? (
                    <span className="absolute inset-x-0 -bottom-4 text-[10px] font-bold text-brand-gold-ink">
                      {text(`${choice.few} left`, `${choice.few} बाँकी`)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {live.colors.length > 1 ? (
          <div className="grid gap-2">
            <span className="text-sm font-bold">{text("Colour", "रङ")}</span>
            <div className="flex flex-wrap gap-2">
              {live.colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={color === item}
                  onClick={() => setColor(item)}
                  className={`h-10 rounded-full border-[1.5px] px-4 text-sm font-bold ${
                    color === item ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line bg-brand-paper"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : live.colors[0] ? (
          <p className="text-sm text-brand-muted">
            {text("Colour", "रङ")}: <b className="text-brand-green-ink">{live.colors[0]}</b>
          </p>
        ) : null}

        <button
          type="button"
          onClick={add}
          disabled={ordered.length === 0}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-green-ink px-4 text-base font-extrabold text-white transition hover:bg-brand-green disabled:cursor-not-allowed disabled:bg-brand-green-line disabled:text-brand-muted"
        >
          {ordered.length > 0 ? <ShoppingBagIcon className="h-4 w-4" /> : null}
          {label}
        </button>
        <p className="text-center text-xs text-brand-muted">
          {text("Cash on delivery · we call to confirm your size", "आएपछि तिर्ने · साइज पक्का गर्न हामी फोन गर्छौँ")}
        </p>
      </div>
    </dialog>
  );
}

/**
 * The line that says what went in, above the tab bar, for a few seconds.
 * Drawn on the page's body: inside a card it would ride the card's transform.
 */
export function AddedToast({ message, onDone }: { message: { en: string; ne: string } | null; onDone: () => void }) {
  const { text } = useLanguage();
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(id);
  }, [message, onDone]);
  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-brand-green-ink px-4 py-3 text-sm font-bold text-white shadow-2xl lg:bottom-6"
    >
      <span className="min-w-0">{text(message.en, message.ne)}</span>
      <a href="/cart" className="shrink-0 text-brand-gold-bright underline-offset-4 hover:underline">
        {text("View cart →", "कार्ट हेर्ने →")}
      </a>
    </div>,
    document.body,
  );
}
