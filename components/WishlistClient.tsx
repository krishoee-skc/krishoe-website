"use client";

import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { useCommerce } from "@/components/commerce/CommerceProvider";

export default function WishlistClient() {
  const { products, wishlist } = useCommerce();
  const wishlistProducts = products.filter((product) => wishlist.includes(product.id));

  if (wishlistProducts.length === 0) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-10 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Wishlist</p>
        <h1 className="mt-3 text-4xl font-black text-brand-green-ink">Save pairs you love.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-brand-muted">
          Tap the heart on a product to build a more personal KRISHOE collection.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          Discover products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {wishlistProducts.map((product, index) => (
        <ProductCard key={product.id} product={product} intent="shop" eager={index === 0} />
      ))}
    </div>
  );
}
