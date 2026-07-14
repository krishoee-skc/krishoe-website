import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { ArrowRightIcon, StarIcon } from "@/components/Icons";
import ProductCardActions from "@/components/ProductCardActions";

type ProductCardProps = {
  product: Product;
  intent?: "shop" | "collection";
  eager?: boolean;
};

export default function ProductCard({
  product,
  intent = "collection",
  eager = false,
}: ProductCardProps) {
  const href = `/product/${product.id}`;

  return (
    <article
      id={product.id}
      className="group overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_18px_40px_rgba(11,77,59,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(11,77,59,0.14)]"
    >
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-[#F5F7F4]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0B4D3B] shadow-sm">
          {product.badge ?? product.category}
        </div>
      </Link>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B98A2E]">
              {product.category}
            </p>
            <Link href={href}>
              <h3 className="mt-2 text-xl font-semibold text-[#10231D] transition hover:text-[#0B4D3B]">
                {product.name}
              </h3>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-[#10231D] px-2.5 py-1 text-xs font-semibold text-white">
            <StarIcon className="h-3.5 w-3.5 text-[#D4AF37]" />
            {product.rating}
          </div>
        </div>

        <p className="min-h-12 text-sm leading-6 text-[#5F6B66]">{product.description}</p>

        <div className="flex items-center justify-between border-t border-black/10 pt-4">
          <span className="text-2xl font-bold text-[#0B4D3B]">{product.price}</span>
          <Link
            href={href}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold text-[#10231D] transition hover:border-[#0B4D3B] hover:text-[#0B4D3B]"
          >
            {intent === "shop" ? "Details" : "View"}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <ProductCardActions product={product} />
      </div>
    </article>
  );
}
