"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/products";
import { describeStockShortfalls } from "@/lib/order-stock";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";
import { sizeChoices } from "@/components/SizeSheet";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * freeOverPaisa: the order value from which delivery is free, from Settings —
 * 0 when the shop has no such line. The bar under the subtotal fills toward it
 * (owner, 2026-10-01: "Rs. 850 more for free delivery").
 */
export default function CartClient({ freeOverPaisa = 0 }: { freeOverPaisa?: number }) {
  const { text } = useLanguage();
  const { cartItems, subtotal, subtotalLabel, removeFromCart, updateQuantity, changeSize, products, stockShortfalls, canCheckout } =
    useCommerce();
  // Which line just had its size changed, and to what — said under it for a moment.
  const [moved, setMoved] = useState<{ productId: string; color: string; size: string } | null>(null);
  function moveSize(key: string, productId: string, color: string, size: string) {
    changeSize(key, size);
    setMoved({ productId, color, size });
    window.setTimeout(() => setMoved((current) => (current?.size === size && current.productId === productId ? null : current)), 2500);
  }
  const toFree = freeOverPaisa > 0 ? Math.max(0, freeOverPaisa - subtotal) : 0;
  const freeShare = freeOverPaisa > 0 ? Math.min(100, Math.round((subtotal / freeOverPaisa) * 100)) : 0;
  const shortfallByProductId = new Map(
    stockShortfalls.map((shortfall) => [shortfall.productId, shortfall]),
  );

  if (cartItems.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-brand-paper p-10 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          {text("Your cart", "तपाईंको कार्ट")}
        </p>
        <h2 className="mt-3 text-4xl font-black text-brand-green-ink">
          {text("Cart is waiting for a good pair.", "कार्टले राम्रो जोडी पर्खिरहेको छ।")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          {text(
            "Add premium KRISHOE styles to your cart and continue to a guided checkout.",
            "मनपर्ने KRISHOE जुत्ता कार्टमा थप्नुहोस् र सजिलो तरिकाले अर्डर पूरा गर्नुहोस्।",
          )}
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          {text("Browse collection", "सङ्ग्रह हेर्नुहोस्")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {cartItems.map((item) => (
          <article key={item.key} className="krishoe-rise grid gap-5 rounded-lg border border-black/10 bg-brand-paper p-4 shadow-sm sm:grid-cols-[140px_1fr]">
            <Link href={`/product/${item.productId}`} className="relative aspect-square overflow-hidden rounded-lg bg-brand-mist">
              <Image src={item.image} alt={item.name} fill sizes="140px" className="object-cover" />
            </Link>
            <div className="flex flex-col justify-between gap-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <Link href={`/product/${item.productId}`}>
                    <h2 className="text-xl font-black text-brand-green-ink hover:text-brand-green">{item.name}</h2>
                  </Link>
                  {/* The size can be changed right here (owner, 2026-10-02): a
                      pair added in the wrong size used to mean removing it and
                      finding the shoe again. A size the shelf has none of is
                      not offered, unless it is the one already chosen. */}
                  {(() => {
                    const product = products.find((entry) => entry.id === item.productId);
                    const options = product ? sizeChoices(product).filter((choice) => !choice.soldOut || choice.size === item.size) : [];
                    return (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-muted">
                        {options.length > 1 ? (
                          <label className="inline-flex items-center gap-2">
                            {text("Size", "साइज")}
                            <select
                              value={item.size}
                              onChange={(event) => moveSize(item.key, item.productId, item.color, event.target.value)}
                              aria-label={text(`Size of ${item.name}`, `${item.name} को साइज`)}
                              className="h-10 rounded-xl border-[1.5px] border-brand-green-ink bg-brand-paper px-2 text-base font-bold text-brand-green-ink"
                            >
                              {options.map((choice) => (
                                <option key={choice.size} value={choice.size}>
                                  {choice.size}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span>
                            {text("Size", "साइज")} {item.size}
                          </span>
                        )}
                        <span>/ {item.color}</span>
                        {moved && moved.productId === item.productId && moved.color === item.color && moved.size === item.size ? (
                          <span role="status" className="font-bold text-brand-green">
                            {text(`Size changed to ${item.size}`, `साइज ${item.size} मा फेरियो`)}
                          </span>
                        ) : null}
                      </p>
                    );
                  })()}
                  {shortfallByProductId.has(item.productId) ? (
                    <p className="mt-2 text-sm font-semibold text-brand-clay">
                      {item.available === 0
                        ? text("Out of stock", "स्टक सकियो")
                        : text(
                            `Only ${item.available} in stock`,
                            `स्टकमा ${item.available} जोडी मात्र`,
                          )}
                    </p>
                  ) : null}
                </div>
                <p className="text-xl font-black text-brand-green">{formatPrice(item.lineTotal)}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex h-11 items-center rounded-full border border-black/10">
                  <button
                    type="button"
                    aria-label={text("Decrease quantity", "सङ्ख्या घटाउनुहोस्")}
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    className="grid h-11 w-11 place-items-center text-brand-green transition active:scale-90"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-black text-brand-green-ink">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={text("Increase quantity", "सङ्ख्या बढाउनुहोस्")}
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    className="grid h-11 w-11 place-items-center text-brand-green transition active:scale-90"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.key)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-brand-clay transition hover:border-brand-clay"
                >
                  <TrashIcon className="h-4 w-4" />
                  {text("Remove", "हटाउनुहोस्")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-lg border border-black/10 bg-brand-green-ink p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">
          {text("Order summary", "अर्डर विवरण")}
        </p>
        <div className="mt-6 space-y-4 border-b border-white/10 pb-6 text-sm text-white/[.72]">
          <div className="flex justify-between">
            <span>{text("Subtotal", "जम्मा")}</span>
            <span className="font-bold text-white">{subtotalLabel}</span>
          </div>
          {freeOverPaisa > 0 ? (
            <div data-free-delivery>
              <p className="text-sm font-bold text-white">
                {toFree > 0
                  ? text(`Add ${formatPrice(toFree)} more for free delivery`, `${formatPrice(toFree)} थपे डेलिभरी निःशुल्क`)
                  : text("Free delivery on this order ✓", "यो अर्डरमा डेलिभरी निःशुल्क ✓")}
              </p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={freeShare}
                aria-label={text("Toward free delivery", "निःशुल्क डेलिभरीसम्म")}
              >
                <span className="block h-full rounded-full bg-brand-gold-bright transition-[width] duration-500" style={{ width: `${freeShare}%` }} />
              </div>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>{text("Delivery", "डेलिभरी")}</span>
            <span>{text("Calculated after inquiry", "सोधपुछपछि निर्धारण")}</span>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-white/[.72]">{text("Estimated total", "अनुमानित कुल")}</span>
          <span className="text-3xl font-black">{subtotalLabel}</span>
        </div>
        {canCheckout ? (
          <Link
            href="/checkout"
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-brand-paper"
          >
            {text("Continue checkout", "अर्डर अगाडि बढाउनुहोस्")}
          </Link>
        ) : (
          <div className="mt-7">
            <p
              role="status"
              className="rounded-lg bg-white/[.12] px-4 py-3 text-sm font-semibold leading-6 text-white"
            >
              {describeStockShortfalls(stockShortfalls)}.{" "}
              {text(
                "Please update the quantity to continue.",
                "अगाडि बढ्न सङ्ख्या मिलाउनुहोस्।",
              )}
            </p>
            <span
              aria-disabled="true"
              className="mt-3 inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-white/20 px-6 text-sm font-black text-white/60"
            >
              {text("Continue checkout", "अर्डर अगाडि बढाउनुहोस्")}
            </span>
          </div>
        )}
        <Link
          href="/shop"
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 px-6 text-sm font-black text-white transition hover:bg-brand-paper hover:text-brand-green-ink"
        >
          {text("Keep shopping", "किनमेल जारी राख्नुहोस्")}
        </Link>
      </aside>
    </div>
  );
}
