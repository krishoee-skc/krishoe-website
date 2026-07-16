"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/products";
import { describeStockShortfalls } from "@/lib/order-stock";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";

export default function CartClient() {
  const { cartItems, subtotalLabel, removeFromCart, updateQuantity, stockShortfalls, canCheckout } =
    useCommerce();
  const shortfallByProductId = new Map(
    stockShortfalls.map((shortfall) => [shortfall.productId, shortfall]),
  );

  if (cartItems.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-10 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Your cart</p>
        <h1 className="mt-3 text-4xl font-black text-brand-green-ink">Cart is waiting for a good pair.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          Add premium KRISHOE styles to your cart and continue to a guided checkout.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          Browse collection
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {cartItems.map((item) => (
          <article key={item.key} className="grid gap-5 rounded-lg border border-black/10 bg-white p-4 shadow-sm sm:grid-cols-[140px_1fr]">
            <Link href={`/product/${item.productId}`} className="relative aspect-square overflow-hidden rounded-lg bg-brand-mist">
              <Image src={item.image} alt={item.name} fill sizes="140px" className="object-cover" />
            </Link>
            <div className="flex flex-col justify-between gap-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <Link href={`/product/${item.productId}`}>
                    <h2 className="text-xl font-black text-brand-green-ink hover:text-brand-green">{item.name}</h2>
                  </Link>
                  <p className="mt-2 text-sm text-brand-muted">
                    Size {item.size} / {item.color}
                  </p>
                  {shortfallByProductId.has(item.productId) ? (
                    <p className="mt-2 text-sm font-semibold text-brand-clay">
                      {item.available === 0
                        ? "Out of stock"
                        : `Only ${item.available} in stock`}
                    </p>
                  ) : null}
                </div>
                <p className="text-xl font-black text-brand-green">{formatPrice(item.lineTotal)}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex h-11 items-center rounded-full border border-black/10">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    className="grid h-11 w-11 place-items-center text-brand-green"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-black text-brand-green-ink">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    className="grid h-11 w-11 place-items-center text-brand-green"
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
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-lg border border-black/10 bg-brand-green-ink p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-bright">Order summary</p>
        <div className="mt-6 space-y-4 border-b border-white/10 pb-6 text-sm text-white/72">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-white">{subtotalLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>Calculated after inquiry</span>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-white/72">Estimated total</span>
          <span className="text-3xl font-black">{subtotalLabel}</span>
        </div>
        {canCheckout ? (
          <Link
            href="/checkout"
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-gold-bright px-6 text-sm font-black text-brand-green-ink transition hover:bg-white"
          >
            Continue checkout
          </Link>
        ) : (
          <div className="mt-7">
            <p
              role="status"
              className="rounded-lg bg-white/12 px-4 py-3 text-sm font-semibold leading-6 text-white"
            >
              {describeStockShortfalls(stockShortfalls)}. Please update the quantity to continue.
            </p>
            <span
              aria-disabled="true"
              className="mt-3 inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-white/20 px-6 text-sm font-black text-white/60"
            >
              Continue checkout
            </span>
          </div>
        )}
        <Link
          href="/shop"
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 px-6 text-sm font-black text-white transition hover:bg-white hover:text-brand-green-ink"
        >
          Keep shopping
        </Link>
      </aside>
    </div>
  );
}
