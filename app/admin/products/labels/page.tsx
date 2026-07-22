/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import PrintButton from "@/components/admin/PrintButton";
import LoadFailure from "@/components/admin/LoadFailure";
import { getProducts } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Barcode labels | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

async function loadProducts() {
  try {
    return { products: await getProducts({ includeDrafts: true }), error: "" };
  } catch (error) {
    reportError("load the barcode labels", error);
    return { products: null, error: saveFailureMessage(error, "Could not load products.") };
  }
}

export default async function ProductLabelsPage() {
  const loaded = await loadProducts();

  if (!loaded.products) {
    return <LoadFailure what="the barcode labels" message={loaded.error} retryHref="/admin/products/labels" />;
  }

  // Every design carries a SKU (auto-generated if not set), so all of them can
  // be labelled.
  const products = [...loaded.products].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="p-6 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/admin/products"
            className="text-sm font-bold text-brand-green underline underline-offset-4"
          >
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink">Barcode labels</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            हरेक design को SKU barcode — sticker paper मा print गरी बट्टा/rack मा टाँस्नुहोस्। POS मा scan गर्नासाथ
            सामान बिलमा झर्छ।
          </p>
        </div>
        <PrintButton className="inline-flex h-11 items-center rounded-full bg-brand-green-ink px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
          Print labels
        </PrintButton>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
          No products yet. Buy or make some from Purchasing.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-1">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-3 text-center print:break-inside-avoid"
            >
              <p className="line-clamp-2 text-xs font-black text-brand-green-ink">{product.name}</p>
              <img
                src={`/api/admin/products/${product.id}/barcode`}
                alt={`Barcode for ${product.name}`}
                className="h-14 w-full object-contain"
              />
              <p className="text-xs font-bold text-brand-green">{product.price}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
