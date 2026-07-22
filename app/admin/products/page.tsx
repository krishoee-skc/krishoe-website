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
          <h1 className="text-2xl font-black text-brand-green-ink">Products</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Create, edit, publish, draft, delete, and sync catalog stock with finished goods.
          </p>
        </div>
        <form action={syncProductCatalogStockAction}>
          <FormSubmitButton
            className="h-10 rounded-full border border-brand-green bg-white px-4 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
            pendingLabel="Syncing…"
          >
            Sync stock
          </FormSubmitButton>
        </form>
      </div>

      <div className="mt-6">
        <ProductForm key={editingProduct?.id ?? "new"} product={editingProduct} categories={categories} />
      </div>

      <ProductsClient products={products} editingId={editingProduct?.id ?? null} />
    </section>
  );
}
