import Link from "next/link";
import LoadFailure from "@/components/admin/LoadFailure";
import { getProducts } from "@/lib/product-store";
import { formatPrice } from "@/lib/products";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata = {
  title: "Stock | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "plain" | "good" | "warn";
}) {
  const valueTone =
    tone === "warn" ? "text-brand-clay" : tone === "good" ? "text-brand-green" : "text-brand-green-ink";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${valueTone}`}>{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">{detail}</p>
    </div>
  );
}

async function loadProducts() {
  try {
    return { products: await getProducts({ includeDrafts: true }), error: "" };
  } catch (error) {
    reportError("load the stock list", error);
    return { products: null, error: saveFailureMessage(error, "Could not load stock.") };
  }
}

export default async function AdminStockPage() {
  const loaded = await loadProducts();

  if (!loaded.products) {
    return <LoadFailure what="the stock list" message={loaded.error} retryHref="/admin/stock" />;
  }

  const products = loaded.products;
  // Out of stock first, so what needs buying reads at the top.
  const sorted = [...products].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  const totalPairs = products.reduce((total, product) => total + product.stock, 0);
  const outOfStock = products.filter((product) => product.stock === 0).length;
  const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 5).length;
  const stockValue = products.reduce((total, product) => total + product.priceValue * product.stock, 0);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Stock</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Every design with the pairs on hand and its price. What is out of stock shows first.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex h-10 items-center rounded-full border border-brand-green bg-white px-4 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
        >
          Manage products
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Designs" value={products.length} detail="in the catalog" />
        <StatCard label="Pairs in stock" value={totalPairs} detail="across all designs" />
        <StatCard
          label="Out of stock"
          value={outOfStock}
          detail={`${lowStock} low (5 or fewer)`}
          tone={outOfStock > 0 ? "warn" : "good"}
        />
        <StatCard label="Stock value" value={formatPrice(stockValue)} detail="at selling price" />
      </div>

      {sorted.length === 0 ? (
        <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
          No products yet. Buy or make some from Purchasing.
        </p>
      ) : (
        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-green-ink">{product.name}</p>
                <p className="text-xs text-gray-500">
                  {product.price}
                  {product.status === "Draft" ? " · Draft" : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                  product.stock > 0
                    ? "bg-brand-green-tint text-brand-green"
                    : "bg-brand-clay-tint text-brand-clay"
                }`}
              >
                {product.stock > 0 ? `${product.stock} pairs` : "Out"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
