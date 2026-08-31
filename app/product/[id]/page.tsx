import type { Metadata } from "next";
import ProductText from "@/components/commerce/ProductText";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, getProducts } from "@/lib/product-store";
import { getProductByIdFromList, getRelatedProductsFromList } from "@/lib/products";
import { JsonLdScript } from "@/components/commerce/StructuredData";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductDetailActions from "@/components/ProductDetailActions";
import ProductGallery from "@/components/ProductGallery";
import ProductCard from "@/components/ProductCard";
import RecentlyViewed from "@/components/RecentlyViewed";
import { CheckIcon, StarIcon } from "@/components/Icons";
import ProductReviewsPanel from "@/components/ProductReviewsPanel";
import { getPublishedReviews } from "@/lib/customer-voice";
import { stockLevel } from "@/lib/stock-thresholds";
import ShareProduct from "@/components/ShareProduct";
import T from "@/components/T";
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

/**
 * Every product gets its own built page.
 *
 * This is where a Facebook ad lands, where a shared link lands, and where a
 * Google result lands — the page a shopper meets KRISHOE on. It was taking 2.3
 * seconds and never caching, against 0.45 for /shop, because working out who
 * was reading meant reading a cookie and one request-time read makes a whole
 * route dynamic. That work moved to the browser; this makes the page itself.
 *
 * dynamicParams stays on, its default: a shoe added after the last build still
 * has a page, rendered the first time somebody asks for it. And the ten-second
 * revalidate the catalogue already runs on means a shoe that was removed stops
 * being served within ten seconds — which is the failure this has to avoid,
 * because a prerendered page for a deleted product is exactly what put 404s in
 * front of shoppers after the trial data was cleared.
 */
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ id: product.id }));
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const products = await getProducts();
  const product = getProductByIdFromList(products, id);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProductsFromList(products, product);

  // The reviews the shop has published, from the one inbox the owner approves
  // in — the on-page form and the after-delivery invite both land there. Read
  // by product id, not by cookie, so the page stays statically cached.
  const publishedReviews = (await getPublishedReviews(product.id)).map((review) => ({
    id: review.id,
    name: review.customerName,
    comment: review.message,
    rating: review.rating,
    createdAt: review.createdAt,
    // A review carries an order id only when it came from a real, matched
    // purchase — that is exactly what earns the "verified" badge.
    verifiedPurchase: review.orderId !== "",
  }));

  const level = stockLevel(product.stock);
  // The product's own name, description and highlights are catalog data the
  // owner types in; only KRISHOE's own wording is translated here.
  const stockLabel =
    level === "out"
      ? { en: "Sold out", ne: "बिक्री सकियो" }
      : level === "low"
        ? { en: `Only ${product.stock} left`, ne: `${product.stock} जोडी मात्र बाँकी` }
        : { en: "Ready stock", ne: "स्टकमा उपलब्ध" };
  const serviceItems = [
    { en: "Stock checked before payment", ne: "भुक्तानीअघि स्टक जाँचिन्छ" },
    { en: "Cash on delivery available", ne: "सामान बुझ्दा नगद सुविधा" },
    { en: "WhatsApp support for sizing", ne: "साइजका लागि WhatsApp मा सोध्नुहोस्" },
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
      <Navbar />
      <div className="pb-24 md:pb-0">
      <main className="bg-brand-paper">
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
                  <T en={stockLabel.en} ne={stockLabel.ne} />
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
                <ProductText en={product.name} ne={product.nameNe} />
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
              <p className="mt-6 text-base leading-7 text-brand-muted">
                <ProductText en={product.description} ne={product.descriptionNe} />
              </p>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {serviceItems.map((item) => (
                  <div
                    key={item.en}
                    className="flex min-h-12 items-center gap-2 rounded-lg border border-brand-green/15 bg-brand-mist px-3 text-sm font-bold text-brand-green-ink"
                  >
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand-green" />
                    <T en={item.en} ne={item.ne} />
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
                  // Value untranslated where it is catalog data the owner typed.
                  { label: { en: "SKU", ne: "SKU" }, value: { en: product.sku, ne: product.sku } },
                  {
                    label: { en: "Material", ne: "सामग्री" },
                    value: { en: product.material, ne: product.material },
                  },
                  { label: { en: "Fit", ne: "फिटिङ" }, value: { en: product.fit, ne: product.fit } },
                  {
                    label: { en: "Delivery", ne: "डेलिभरी" },
                    value: {
                      en: "Kathmandu Valley and Nepal courier",
                      ne: "काठमाडौं उपत्यका र देशभर कुरियर",
                    },
                  },
                  {
                    label: { en: "Payment", ne: "भुक्तानी" },
                    value: {
                      en: "COD or digital after stock confirmation",
                      ne: "नगद, वा स्टक पक्का भएपछि अनलाइन",
                    },
                  },
                  { label: { en: "Stock", ne: "स्टक" }, value: stockLabel },
                ].map((row) => (
                  <p key={row.label.en} className="rounded-lg bg-brand-mist px-4 py-3">
                    <span className="font-semibold text-brand-green-ink">
                      <T en={row.label.en} ne={row.label.ne} />:
                    </span>{" "}
                    <T en={row.value.en} ne={row.value.ne} />
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
                    <T en="Product notes" ne="सामानको जानकारी" />
                  </p>
                  <h3 className="mt-3 text-2xl font-black text-brand-green-ink md:text-3xl">
                    <T en="About this product" ne="यो सामानबारे" />
                  </h3>
                  <p className="mt-4 leading-7 text-brand-muted">{product.longDescription}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-lg border border-black/10 bg-brand-paper p-5 shadow-sm">
                    <h4 className="font-black text-brand-green-ink">
                      <T en="Highlights" ne="मुख्य कुरा" />
                    </h4>
                    <ul className="mt-4 grid gap-2 text-sm text-brand-muted">
                      {product.highlights.map((highlight) => (
                        <li key={highlight} className="flex gap-2">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-black/10 bg-brand-paper p-5 shadow-sm">
                    <h4 className="font-black text-brand-green-ink">
                      <T en="Care" ne="हेरचाह" />
                    </h4>
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
          <section className="bg-brand-paper py-14 md:py-20">
            <div className="mx-auto max-w-7xl px-5 md:px-8">
              <h2 className="text-2xl font-black tracking-tight text-brand-green-ink md:text-4xl">
                <T en="You might also like" ne="यी पनि मन पर्न सक्छ" />
              </h2>
              <div className="mt-8 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} intent="shop" />
                ))}
              </div>
            </div>
          </section>
        )}

        <RecentlyViewed excludeId={product.id} />
      </main>

      <ProductReviewsPanel product={product} reviews={publishedReviews} />

      <Footer />
      </div>
    </>
  );
}
