import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById, getRelatedProducts } from "@/lib/product-store";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductDetailActions from "@/components/ProductDetailActions";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import { StarIcon } from "@/components/Icons";
import ProductReviews from "@/components/ProductReviews";
import {
  breadcrumbJsonLd,
  createProductMetadata,
  productJsonLd,
} from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {
      title: "Product Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return createProductMetadata(product);
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product);

  return (
    <>
      <JsonLdScript data={productJsonLd(product)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: product.category, path: `/shop/${product.categorySlug}` },
          { name: product.name, path: `/product/${product.id}` },
        ])}
      />
      <Navbar />
      <main className="bg-white">
        <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#F5F7F4]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {product.gallery.slice(0, 4).map((imgUrl, index) => (
                  <div key={index} className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#F5F7F4]">
                    <Image
                      src={imgUrl}
                      alt={`${product.name} gallery image ${index + 1}`}
                      fill
                      sizes="25vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
                {product.category}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-5xl">
                {product.name}
              </h1>
              <div className="mt-4 flex items-center gap-4">
                <span className="text-3xl font-bold text-[#0B4D3B]">{product.price}</span>
                <div className="flex items-center gap-1 rounded-full bg-[#10231D] px-3 py-1 text-sm font-semibold text-white">
                  <StarIcon className="h-4 w-4 text-[#D4AF37]" />
                  {product.rating}
                </div>
              </div>
              <p className="mt-6 text-base leading-7 text-[#5F6B66]">{product.description}</p>

              <div className="mt-8">
                <ProductDetailActions product={product} />
              </div>

              <div className="mt-10 space-y-4 border-t border-black/10 pt-6 text-sm text-[#5F6B66]">
                <p><span className="font-semibold text-[#10231D]">Material:</span> {product.material}</p>
                <p><span className="font-semibold text-[#10231D]">Fit:</span> {product.fit}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F5F7F4] py-16">
            <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
                <h3 className="text-2xl font-bold text-[#10231D]">About This Product</h3>
                <p className="mt-4 leading-7 text-[#5F6B66]">{product.longDescription}</p>
                <ul className="mt-6 list-inside list-disc space-y-2 text-left text-[#5F6B66]">
                    {product.highlights.map((highlight, i) => <li key={i}>{highlight}</li>)}
                </ul>
            </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="bg-white py-20">
            <div className="mx-auto max-w-7xl px-5 md:px-8">
              <h2 className="text-3xl font-black tracking-tight text-[#10231D] md:text-4xl">You Might Also Like</h2>
              <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <ProductReviews product={product} />

      <Footer />
    </>
  );
}
