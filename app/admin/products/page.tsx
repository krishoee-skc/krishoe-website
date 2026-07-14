import ProductForm from "@/app/admin/ProductForm";
import ProductsClient from "@/app/admin/ProductsClient";
import { syncProductCatalogStockAction } from "@/app/admin/products/actions";
import { categories } from "@/lib/products";
import { getProducts } from "@/lib/product-store";

export const metadata = {
  title: "Products | KRISHOE Admin",
};

type AdminProductsPageProps = {
  searchParams?: Promise<{
    edit?: string;
  }>;
};

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const products = await getProducts({ includeDrafts: true });
  const resolvedSearchParams = await searchParams;
  const editingProduct = resolvedSearchParams?.edit
    ? products.find((product) => product.id === resolvedSearchParams.edit) ?? null
    : null;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#10231D]">Products</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Create, edit, publish, draft, delete, and sync catalog stock with finished goods.
          </p>
        </div>
        <form action={syncProductCatalogStockAction}>
          <button
            type="submit"
            className="h-10 rounded-full border border-[#0B4D3B] bg-white px-4 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#0B4D3B] hover:text-white"
          >
            Sync stock
          </button>
        </form>
      </div>

      <div className="mt-6">
        <ProductForm key={editingProduct?.id ?? "new"} product={editingProduct} categories={categories} />
      </div>

      <ProductsClient products={products} editingId={editingProduct?.id ?? null} />
    </section>
  );
}
