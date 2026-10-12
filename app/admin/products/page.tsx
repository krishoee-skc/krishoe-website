import Link from "next/link";
import T from "@/components/T";
import ProductForm from "@/app/admin/ProductForm";
import ProductsClient from "@/app/admin/ProductsClient";
import DraftsPanel from "@/app/admin/products/DraftsPanel";
import { syncProductCatalogStockAction } from "@/app/admin/products/actions";
import LoadFailure from "@/components/admin/LoadFailure";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { categories } from "@/lib/products";
import { getProducts } from "@/lib/product-store";
import { getFinishedStock } from "@/lib/operations";
import { shoeReadiness } from "@/lib/product-readiness";
import { stockSizesOf } from "@/lib/stock-by-size";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata = {
  title: "Products | KRISHOE Admin",
};

type AdminProductsPageProps = {
  searchParams?: Promise<{
    edit?: string;
    ai?: string;
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
  // What each Draft still needs (owner, 2026-10-07). An empty stock read only
  // skips the size check; the rest needs nothing but the product.
  const finishedStock = await getFinishedStock();
  const drafts = products
    .filter((product) => product.status === "Draft")
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      ...shoeReadiness(product, stockSizesOf(finishedStock, product.name)),
    }));
  const resolvedSearchParams = await searchParams;
  const editingProduct = resolvedSearchParams?.edit
    ? products.find((product) => product.id === resolvedSearchParams.edit) ?? null
    : null;

  return (
    <section className="p-4 sm:p-6">
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
          {/* Used now and then: one press away, not three buttons in the
              first screen (owner, 2026-10-12). */}
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink [&::-webkit-details-marker]:hidden">
              ⋯ <T en="Labels · codes · sync" ne="स्टिकर · कोड · मिलाउने" />
            </summary>
            <div className="absolute left-0 z-20 mt-2 grid w-60 max-w-[calc(100vw-2rem)] sm:left-auto sm:right-0 gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-lg">
              <Link
                href="/admin/products/labels"
                className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
              >
                <T en="Barcode labels" ne="बारकोडको स्टिकर" />
              </Link>
              <Link
                href="/admin/products/codes"
                className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
              >
                🔢 <T en="Shoe codes" ne="जुत्ताको कोड" />
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
          </details>
        </div>
      </div>

      {/* As the owner's sample (2026-10-12): the figures, the tabs and the
          shoes first; a new shoe from a folded "＋ Add a product" at the
          foot. A shoe being edited keeps its form at the top, where the
          Edit press lands. */}
      {editingProduct ? (
        <div className="mt-6">
          <ProductForm
            key={editingProduct.id}
            product={editingProduct}
            categories={categories}
            takenCodes={products.map(({ id, sku, name }) => ({ id, sku, name }))}
            autoDraft={Boolean(editingProduct) && resolvedSearchParams?.ai === "1"}
          />
        </div>
      ) : null}

      <ProductsClient products={products} editingId={editingProduct?.id ?? null} />

      <DraftsPanel drafts={drafts} />

      {editingProduct ? null : (
        <details id="add-product" className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper">
          <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-base font-black text-brand-green [&::-webkit-details-marker]:hidden">
            ＋ <T en="Add a product" ne="नयाँ जुत्ता थप्ने" />
          </summary>
          <div className="p-2 sm:p-3">
            <ProductForm
              key="new"
              product={null}
              categories={categories}
              takenCodes={products.map(({ id, sku, name }) => ({ id, sku, name }))}
            />
          </div>
        </details>
      )}
    </section>
  );
}
