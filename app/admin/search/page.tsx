import Link from "next/link";
import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { getProducts } from "@/lib/product-store";
import { getOperationsData } from "@/lib/operations";
import { getPurchasingData } from "@/lib/purchasing";
import { getPosSnapshot } from "@/lib/pos";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Search | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function has(haystack: string | undefined, needle: string) {
  return (haystack ?? "").toLowerCase().includes(needle);
}

const LIMIT = 12;

async function loadSearchData() {
  try {
    return {
      data: await Promise.all([
        getProducts({ includeDrafts: true }),
        getOperationsData(),
        getPurchasingData(),
        getPosSnapshot(),
      ]),
      error: "",
    };
  } catch (error) {
    reportError("load the search page", error);
    return { data: null, error: saveFailureMessage(error, "Could not run the search.") };
  }
}

function ResultGroup({
  title,
  children,
  count,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-brand-muted">
        {title} ({count})
      </h2>
      <div className="mt-3 divide-y">{children}</div>
    </section>
  );
}

export default async function AdminSearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  const loaded = await loadSearchData();
  if (!loaded.data) {
    return <LoadFailure what="the search" message={loaded.error} retryHref="/admin/search" />;
  }

  const [products, operations, purchasing, pos] = loaded.data;

  const productHits = query
    ? products.filter((p) => has(p.name, query) || has(p.sku, query)).slice(0, LIMIT)
    : [];
  const customerHits = query
    ? operations.customerLedgers
        .filter((c) => has(c.customerName, query) || has(c.phone, query))
        .slice(0, LIMIT)
    : [];
  const supplierHits = query
    ? purchasing.supplierLedgers
        .filter((s) => has(s.supplierName, query) || has(s.phone, query))
        .slice(0, LIMIT)
    : [];
  const posHits = query
    ? pos.invoices
        .filter(
          (i) => has(i.invoiceNumber, query) || has(i.customerName, query) || has(i.phone, query),
        )
        .slice(0, LIMIT)
    : [];
  const purchaseHits = query
    ? purchasing.purchaseInvoices
        .filter((p) => has(p.purchaseNumber, query) || has(p.supplierName, query))
        .slice(0, LIMIT)
    : [];

  const total =
    productHits.length +
    customerHits.length +
    supplierHits.length +
    posHits.length +
    purchaseHits.length;

  const rowClass = "flex items-center justify-between gap-3 py-3";
  const linkClass =
    "font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 transition hover:text-brand-green";

  return (
    <section className="p-6">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          सामान, ग्राहक, आपूर्तिकर्ता, वा बिल — नाम, फोन, वा नम्बरले खोज्नुहोस्।
        </p>
      </div>

      <form action="/admin/search" className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Name, phone, bill number…"
          className="h-12 min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-5 text-base outline-none focus:border-brand-green"
        />
        <button
          type="submit"
          className="h-12 rounded-full bg-brand-green-ink px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
        >
          Search
        </button>
      </form>

      {query ? (
        total === 0 ? (
          <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            &ldquo;{q}&rdquo; — केही भेटिएन। नाम, फोन, वा बिल नम्बर हेरेर फेरि खोज्नुहोस्।
          </p>
        ) : (
          <>
            <ResultGroup title="Customers" count={customerHits.length}>
              {customerHits.map((c) => (
                <div key={c.id} className={rowClass}>
                  <div className="min-w-0">
                    <Link href={`/admin/operations/ledger/${c.id}`} className={linkClass}>
                      {c.customerName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {c.channel} · {c.phone || "no phone"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-clay">{money(c.balanceDue)}</span>
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Suppliers" count={supplierHits.length}>
              {supplierHits.map((s) => (
                <div key={s.id} className={rowClass}>
                  <div className="min-w-0">
                    <Link href={`/admin/purchasing/supplier/${s.id}`} className={linkClass}>
                      {s.supplierName}
                    </Link>
                    <p className="text-xs text-gray-500">{s.phone || "no phone"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-clay">{money(s.balanceDue)}</span>
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Sales bills" count={posHits.length}>
              {posHits.map((i) => (
                <div key={i.id} className={rowClass}>
                  <div className="min-w-0">
                    <Link href={`/admin/pos/${i.id}`} className={linkClass}>
                      {i.invoiceNumber}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {i.customerName} · {i.phone || "no phone"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-green-ink">{money(i.total)}</span>
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Purchase bills" count={purchaseHits.length}>
              {purchaseHits.map((p) => (
                <div key={p.id} className={rowClass}>
                  <div className="min-w-0">
                    <Link href={`/admin/purchasing/${p.id}`} className={linkClass}>
                      {p.purchaseNumber}
                    </Link>
                    <p className="text-xs text-gray-500">{p.supplierName}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-green-ink">{money(p.total)}</span>
                </div>
              ))}
            </ResultGroup>

            <ResultGroup title="Products" count={productHits.length}>
              {productHits.map((p) => (
                <div key={p.id} className={rowClass}>
                  <div className="min-w-0">
                    <Link href={`/product/${p.id}`} className={linkClass}>
                      {p.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {p.sku} · {p.price}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      p.stock > 0 ? "text-brand-green" : "text-brand-clay"
                    }`}
                  >
                    {p.stock > 0 ? `${p.stock} pairs` : "Out"}
                  </span>
                </div>
              ))}
            </ResultGroup>
          </>
        )
      ) : (
        <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
          माथि टाइप गरेर खोज्नुहोस् — जस्तै ग्राहकको नाम, फोन नम्बर, वा बिल नम्बर।
        </p>
      )}
    </section>
  );
}
