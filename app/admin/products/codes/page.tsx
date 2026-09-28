import Link from "next/link";
import T from "@/components/T";
import LoadFailure from "@/components/admin/LoadFailure";
import { categories } from "@/lib/products";
import { getProducts } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { CODE_GROUPS, codeGroupFor, suggestCodes } from "@/lib/shoe-code";
import CodesForm from "./CodesForm";

export const metadata = {
  title: "Shoe codes | KRISHOE Admin",
};

async function loadProducts() {
  try {
    return { products: await getProducts({ includeDrafts: true }), error: "" };
  } catch (error) {
    reportError("load the product codes", error);
    return { products: null, error: saveFailureMessage(error, "Could not load the product list.") };
  }
}

/**
 * Every shoe's code on one page, with a KR code suggested beside any that
 * does not have one yet (the owner chose KR-205 on 2026-09-28). Nothing
 * changes until the owner reads the list and presses Save.
 */
export default async function ProductCodesPage() {
  const loaded = await loadProducts();
  if (!loaded.products) {
    return <LoadFailure what="the product codes" message={loaded.error} retryHref="/admin/products/codes" />;
  }

  const suggested = suggestCodes(loaded.products);
  const titleOf = new Map(categories.map((category) => [category.slug, category.title]));
  const rows = [...loaded.products]
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: titleOf.get(product.categorySlug) ?? product.category,
      group: codeGroupFor(product.categorySlug),
      current: product.sku,
      suggested: suggested.get(product.id) ?? product.sku,
      status: product.status,
    }))
    .sort((a, b) => a.group - b.group || a.name.localeCompare(b.name));

  return (
    <section className="p-4 md:p-6">
      <Link href="/admin/products" className="text-sm font-bold text-brand-green underline underline-offset-4">
        ← <T en="Products" ne="सामान" />
      </Link>
      <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink md:text-3xl">
        <T en="Shoe codes" ne="जुत्ताको कोड" />
      </h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <T
          en="Each shoe gets a code like KR-205: KR for the shop, the first digit for its group, then its number. At the counter type just 205, or 205-38 for size 38."
          ne="हरेक जुत्ताको KR-205 जस्तो कोड हुन्छ: KR पसलको, पहिलो अङ्क समूहको, त्यसपछि त्यसको नम्बर। POS मा 205 मात्र, वा साइज 38 का लागि 205-38 लेखे पुग्छ।"
        />
      </p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        {CODE_GROUPS.map((group) => (
          <li key={group.group} className="rounded-full border border-brand-green-line bg-brand-paper px-3 py-1 text-brand-green-ink">
            <span className="font-mono">KR-{group.group}xx</span> · <T en={group.en} ne={group.ne} />
          </li>
        ))}
      </ul>
      <CodesForm rows={rows} />
    </section>
  );
}
