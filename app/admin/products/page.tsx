import Link from "next/link";
import T from "@/components/T";
import ProductForm from "@/app/admin/ProductForm";
import ProductsClient from "@/app/admin/ProductsClient";
import { syncProductCatalogStockAction } from "@/app/admin/products/actions";
import LoadFailure from "@/components/admin/LoadFailure";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { categories } from "@/lib/products";
import { getProducts } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata = {
  title: "Products | KRISHOE Admin",
};

type AdminProductsPageProps = {
  searchParams?: Promise<{
    edit?: string;
  }>;
};

// A cold Neon connection failing here used to throw, and the owner got the
// app's generic retry page — no product list, no form, and nothing saying which
// part had failed. It is the same page they see when the shop itself is down,
// so there was no way to tell a momentary hiccup from something serious.
//
// Loading the list and using the page are separate concerns: the form still
// works when the list will not load, so the failure is reported in place and
// the page keeps working.
async function loadProducts() {
  try {
    return { products: await getProducts({ includeDrafts: true }), error: "" };
  } catch (error) {
    reportError("load the admin product list", error);
    return {
      products: null,
      error: saveFailureMessage(error, "Could not load the product list."),
    };
  }
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const loaded = await loadProducts();

  if (!loaded.products) {
    return (
      <LoadFailure what="the product list" message={loaded.error} retryHref="/admin/products" />
    );
  }

  const products = loaded.products;
  const resolvedSearchParams = await searchParams;
  const editingProduct = resolvedSearchParams?.edit
    ? products.find((product) => product.id === resolvedSearchParams.edit) ?? null
    : null;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-gold-deep">
            <T en="Catalog" ne="सामान · फोटो" />
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
            <T en="Products" ne="सामान" />
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="Create, edit, publish, draft, delete, and sync catalog stock with finished goods."
              ne="जुत्ता थप्ने, सच्याउने, पसलमा देखाउने वा लुकाउने, र स्टक मिलाउने।"
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/products/photos"
            className="inline-flex h-10 items-center rounded-full bg-brand-green px-4 text-sm font-black text-white transition hover:bg-brand-green-ink"
          >
            📷 <T en="Add photos" ne="फोटो हाल्ने" />
          </Link>
          <Link
            href="/admin/products/labels"
            className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            <T en="Barcode labels" ne="बारकोडको स्टिकर" />
          </Link>
          <form action={syncProductCatalogStockAction}>
            <FormSubmitButton
              className="h-10 rounded-full border border-brand-green bg-brand-paper px-4 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
              pendingLabel="Syncing…"
            >
              <T en="Sync stock" ne="स्टक मिलाउने" />
            </FormSubmitButton>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <ProductForm key={editingProduct?.id ?? "new"} product={editingProduct} categories={categories} />
      </div>

      <ProductsClient products={products} editingId={editingProduct?.id ?? null} />
    </section>
  );
}
