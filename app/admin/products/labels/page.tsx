import Link from "next/link";
import type { Metadata } from "next";
import PrintButton from "@/components/admin/PrintButton";
import T from "@/components/T";
import LoadFailure from "@/components/admin/LoadFailure";
import LabelSheet from "@/app/admin/products/labels/LabelSheet";
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
            ← <T en="Products" ne="सामान" />
          </Link>
          <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink"><T en="Barcode labels" ne="बारकोडको स्टिकर" /></h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
            <T
              en="An SKU barcode for each design — print on sticker paper and stick it on the box/rack. Scanning it at the POS drops the item onto the bill."
              ne="हरेक design को SKU barcode — sticker paper मा print गरी बट्टा/rack मा टाँस्नुहोस्। POS मा scan गर्नासाथ सामान बिलमा झर्छ।"
            />
          </p>
        </div>
        <PrintButton className="inline-flex h-11 items-center rounded-full bg-brand-green-ink px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink">
          🖨️ <T en="Print labels" ne="स्टिकर छाप्ने" />
        </PrintButton>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-brand-green-line bg-brand-paper-deep p-4 text-sm font-semibold text-brand-muted">
          <T en="No products yet. Buy or make some from Purchasing." ne="अझै कुनै सामान छैन। किनमेल वा कारखानाबाट थप्नुहोस्।" />
        </p>
      ) : (
        <LabelSheet shoes={products.map((product) => ({ id: product.id, name: product.name, price: String(product.price) }))} />
      )}
    </section>
  );
}
