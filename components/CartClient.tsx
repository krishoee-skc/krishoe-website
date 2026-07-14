"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/products";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/Icons";
import { useCommerce } from "@/components/commerce/CommerceProvider";

export default function CartClient() {
  const { cartItems, subtotalLabel, removeFromCart, updateQuantity } = useCommerce();

  if (cartItems.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-10 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">Your cart</p>
        <h1 className="mt-3 text-4xl font-black text-[#10231D]">Cart is waiting for a good pair.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#5F6B66]">
          Add premium KRISHOE styles to your cart and continue to a guided checkout.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-[#0B4D3B] px-6 text-sm font-bold text-white transition hover:bg-[#D4AF37] hover:text-[#10231D]"
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
            <Link href={`/product/${item.productId}`} className="relative aspect-square overflow-hidden rounded-lg bg-[#F5F7F4]">
              <Image src={item.image} alt={item.name} fill sizes="140px" className="object-cover" />
            </Link>
            <div className="flex flex-col justify-between gap-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <Link href={`/product/${item.productId}`}>
                    <h2 className="text-xl font-black text-[#10231D] hover:text-[#0B4D3B]">{item.name}</h2>
                  </Link>
                  <p className="mt-2 text-sm text-[#5F6B66]">
                    Size {item.size} / {item.color}
                  </p>
                </div>
                <p className="text-xl font-black text-[#0B4D3B]">{formatPrice(item.lineTotal)}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex h-11 items-center rounded-full border border-black/10">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    className="grid h-11 w-11 place-items-center text-[#0B4D3B]"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-black text-[#10231D]">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    className="grid h-11 w-11 place-items-center text-[#0B4D3B]"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.key)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-[#7B3128] transition hover:border-[#7B3128]"
                >
                  <TrashIcon className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-lg border border-black/10 bg-[#10231D] p-6 text-white shadow-[0_24px_70px_rgba(16,35,29,0.20)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#D4AF37]">Order summary</p>
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
        <Link
          href="/checkout"
          className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#D4AF37] px-6 text-sm font-black text-[#10231D] transition hover:bg-white"
        >
          Continue checkout
        </Link>
        <Link
          href="/shop"
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/25 px-6 text-sm font-black text-white transition hover:bg-white hover:text-[#10231D]"
        >
          Keep shopping
        </Link>
      </aside>
    </div>
  );
}
