import type { Metadata } from "next";
import Link from "next/link";
import PhotoCard from "./PhotoCard";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProducts } from "@/lib/product-store";

export const metadata: Metadata = { title: "फोटो हाल्ने | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * A product uploaded from a real camera lands on Vercel Blob; a product that
 * has never been photographed is still showing the category artwork it was
 * created with. Those placeholders sit under /images/, so anything outside that
 * folder is a photograph of an actual shoe.
 */
function hasRealPhoto(image: string) {
  return Boolean(image) && !image.startsWith("/images/");
}

export default async function ProductPhotosPage() {
  await requireAdminPermission("products:write");

  const products = await getProducts({ includeDrafts: true });

  // Missing photos first. Ten products with no picture is the reason to open
  // this page; scrolling past the finished ones to reach them is not.
  const sorted = [...products].sort((left, right) => {
    const leftHas = hasRealPhoto(left.image) ? 1 : 0;
    const rightHas = hasRealPhoto(right.image) ? 1 : 0;
    if (leftHas !== rightHas) return leftHas - rightHas;
    return left.name.localeCompare(right.name);
  });

  const missing = sorted.filter((product) => !hasRealPhoto(product.image)).length;

  return (
    <section className="p-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">फोटो हाल्ने</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
            जुत्ताको फोटो यहीँबाट खिच्नुहोस् वा फाइलबाट छान्नुहोस्। चढ्नेबित्तिकै
            पसलमा देखिन्छ — Save थिच्नु पर्दैन।
          </p>
        </div>
        <Link
          href="/admin/products/photo-guide"
          className="inline-flex h-10 items-center rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          📸 फोटो कसरी खिच्ने
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm font-black">
        <span className={`rounded-full px-3 py-1.5 ${missing > 0 ? "bg-brand-clay text-white" : "bg-emerald-100 text-emerald-900"}`}>
          {missing > 0 ? `${missing} सामानको फोटो छैन` : "सबैको फोटो छ ✅"}
        </span>
        <span className="rounded-full bg-brand-mist px-3 py-1.5 text-brand-muted">
          जम्मा {products.length} सामान
        </span>
      </div>

      {missing > 0 ? (
        <p className="mt-4 rounded-xl bg-brand-mist px-4 py-3 text-sm leading-6 text-brand-muted">
          <strong className="text-brand-green-ink">फोटो नभएको जुत्ता कसैले किन्दैन।</strong>{" "}
          ग्राहकले पहिले फोटो हेर्छन्, अनि मूल्य। तल रातो चिन्ह भएका पहिले सिध्याउनुहोस्।
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((product) => (
          <PhotoCard
            key={product.id}
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              image: product.image,
              galleryCount: product.gallery.length,
              hasRealPhoto: hasRealPhoto(product.image),
            }}
          />
        ))}
      </div>
    </section>
  );
}
