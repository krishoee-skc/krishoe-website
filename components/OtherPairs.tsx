"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { isStandInPhoto, type Product } from "@/lib/products";
import { productPath } from "@/lib/product-url";

/**
 * The other shoes as small tiles (owner's phone sample 3 and 7, 2026-10-24):
 * under the cart, "add another pair"; in an empty cart, the shoes themselves
 * rather than a heading and a link. A tap opens the shoe.
 */
export default function OtherPairs({ products, exclude, title }: { products: Product[]; exclude: string[]; title: string }) {
  const { text } = useLanguage();
  const shown = products.filter((product) => !exclude.includes(product.id) && product.stock > 0).slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <section className="mt-6 text-left" aria-label={title}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold-deep">{title}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((product) => (
          <li key={product.id}>
            <Link href={productPath(product)} className="block overflow-hidden rounded-xl border border-black/10 bg-brand-paper transition hover:-translate-y-0.5">
              <span className="relative block aspect-square bg-brand-mist">
                {isStandInPhoto(product.image) ? (
                  <span className="absolute inset-0 grid place-items-center px-2 text-center text-xs font-bold text-brand-muted">{text("Photo coming soon", "फोटो छिट्टै")}</span>
                ) : (
                  <Image src={product.image} alt={product.name} fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
                )}
              </span>
              <span className="block px-2.5 py-2">
                <span className="block truncate text-sm font-black text-brand-green-ink">{product.name}</span>
                <span className="block text-sm font-black tabular-nums text-brand-green">{product.price}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
