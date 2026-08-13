import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/lib/product-store";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getOrdersForCustomer } from "@/lib/submissions";
import { getProductByIdFromList, getRelatedProductsFromList } from "@/lib/products";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductDetailActions from "@/components/ProductDetailActions";
import ProductGallery from "@/components/ProductGallery";
import ProductCard from "@/components/ProductCard";
import { CheckIcon, StarIcon } from "@/components/Icons";
import ProductReviews from "@/components/ProductReviews";
import { stockLevel } from "@/lib/stock-thresholds";
import ShareProduct from "@/components/ShareProduct";
import {
  absoluteUrl,
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
  const [products, viewer] = await Promise.all([getProducts(), getCurrentCustomer()]);
  const product = getProductByIdFromList(products, id);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProductsFromList(products, product);
  const viewerOrders = viewer ? await getOrdersForCustomer(viewer) : [];
  const existingReview = viewer
    ? product.reviews.some((review) => review.customerUserId === viewer.id)
    : false;
  const verifiedPurchase = viewerOrders.some(
    (order) =>
      order.status === "Closed" &&
      order.items.some((item) => item.productId === product.id && item.quantity > 0),
  );
  const reviewAccess = {
    canReview: Boolean(viewer && verifiedPurchase && !existingReview),
    isLoggedIn: Boolean(viewer),
    reason: !viewer
      ? "Sign in to review a product you purchased."
      : existingReview
        ? "You have already submitted a review for this product."
        : verifiedPurchase
          ? "Your completed purchase is verified."
          : "Reviews open after a completed purchase of this product.",
  };
  const level = stockLevel(product.stock);
  const stockLabel =
    level === "out" ? "Sold out" : level === "low" ? `Only ${product.stock} left` : "Ready stock";
  const serviceItems = [
    "Stock checked before payment",
    "Cash on delivery available",
    "WhatsApp support for sizing",
  ];

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
      <Navbar isLoggedIn={Boolean(viewer)} />
      <div className="pb-24 md:pb-0">
      <main className="bg-white">
        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <ProductGallery name={product.name} image={product.image} gallery={product.gallery} />

            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/shop/${product.categorySlug}`}
                  className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep transition hover:text-brand-green"
                >
                  {product.category}
                </Link>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    level === "out"
                      ? "bg-brand-clay-tint text-brand-clay"
                      : level === "low"
                        ? "bg-brand-cream-soft text-brand-gold-ink"
                        : "bg-brand-green-tint text-brand-green"
                  }`}
                >
                  {stockLabel}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
                {product.name}
              </h1>
              <div className="mt-4 flex items-center gap-4">
                <span className="text-3xl font-bold text-brand-green">{product.price}</span>
                <div className="flex items-center gap-1 rounded-full bg-brand-green-ink px-3 py-1 text-sm font-semibold text-white">
                  <StarIcon className="h-4 w-4 text-brand-gold-bright" />
                  {product.rating}
                </div>
              </div>
              {/* The wholesale price is a trade rate, used only at the POS
                  Wholesale channel — it is deliberately not shown to shoppers
                  on the storefront. */}
              <p className="mt-6 text-base leading-7 text-brand-muted">{product.description}</p>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {serviceItems.map((item) => (
                  <div
                    key={item}
                    className="flex min-h-12 items-center gap-2 rounded-lg border border-brand-green/15 bg-brand-mist px-3 text-sm font-bold text-brand-green-ink"
                  >
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand-green" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <ProductDetailActions product={product} />
                <ShareProduct
                  name={product.name}
                  price={product.price}
                  url={absoluteUrl(`/product/${product.id}`)}
                />
              </div>

              <div className="mt-10 grid gap-3 border-t border-black/10 pt-6 text-sm text-brand-muted sm:grid-cols-2">
                {[
                  ["SKU", product.sku],
                  ["Material", product.material],
                  ["Fit", product.fit],
                  ["Delivery", "Kathmandu Valley and Nepal courier"],
                  ["Payment", "COD or digital after stock confirmation"],
                  ["Stock", stockLabel],
                ].map(([label, value]) => (
                  <p key={label} className="rounded-lg bg-brand-mist px-4 py-3">
                    <span className="font-semibold text-brand-green-ink">{label}:</span> {value}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-brand-mist py-14 md:py-16">
            <div className="mx-auto grid max-w-6xl gap-8 px-5 md:px-8 lg:grid-cols-[1fr_0.8fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
                    Product notes
                  </p>
                  <h3 className="mt-3 text-2xl font-black text-brand-green-ink md:text-3xl">About this product</h3>
                  <p className="mt-4 leading-7 text-brand-muted">{product.longDescription}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
                    <h4 className="font-black text-brand-green-ink">Highlights</h4>
                    <ul className="mt-4 grid gap-2 text-sm text-brand-muted">
                      {product.highlights.map((highlight) => (
                        <li key={highlight} className="flex gap-2">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
                    <h4 className="font-black text-brand-green-ink">Care</h4>
                    <ul className="mt-4 grid gap-2 text-sm text-brand-muted">
                      {product.care.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
            </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="bg-white py-14 md:py-20">
            <div className="mx-auto max-w-7xl px-5 md:px-8">
              <h2 className="text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl">You might also like</h2>
              <div className="mt-8 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} intent="shop" />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <ProductReviews product={product} reviewAccess={reviewAccess} />

      <Footer />
      </div>
    </>
  );
}
