"use client";

import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Product } from "@/lib/products";
import { hasNoPhoto, isSamplePhoto } from "@/lib/product-photo";
import { PencilIcon, TrashIcon } from "@/components/Icons";
import ActionMessage from "@/components/admin/ActionMessage";
import { deleteProductAction, type ActionState } from "@/app/admin/actions";
import { useLanguage } from "@/components/LanguageProvider";

function StatusBadge({ status }: { status: string }) {
  const baseClasses = "rounded-full px-2.5 py-1 text-xs font-semibold";
  switch (status.toLowerCase()) {
    case "active":
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>Active</span>;
    case "draft":
      return <span className={`${baseClasses} bg-brand-mist text-brand-green-ink`}>Draft</span>;
    default:
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
  }
}

type ProductsClientProps = {
  products: Product[];
  editingId?: string | null;
};

export default function ProductsClient({ products, editingId = null }: ProductsClientProps) {
  const { text } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  // A delete that failed used to replace the whole page with the app's error
  // screen. Report it above the table instead and leave the list standing.
  const handleDelete = (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) {
      return;
    }

    const formData = new FormData();
    formData.append("id", product.id);

    startDeleting(async () => {
      const result = await deleteProductAction(state, formData);
      setState(result.ok ? { ...result, message: `Deleted ${product.name}.` } : result);

      if (result.ok) {
        router.refresh();
      }
    });
  };

  if (products.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-brand-green-line bg-brand-paper p-8 text-center">
        <h2 className="text-lg font-black text-brand-green-ink">No products yet</h2>
        <p className="mt-2 text-sm text-brand-muted">Create your first product from the form above.</p>
      </div>
    );
  }

  // Counted over what is on sale. A stand-in on a draft costs nothing; a
  // stand-in on a shoe with stock is shown to every shopper who finds it.
  const wrongPhotos = products.filter(
    (product) =>
      product.stock > 0 && (isSamplePhoto(product.image) || hasNoPhoto(product.image)),
  );

  return (
    <div className="mt-6 space-y-4">
      <ActionMessage state={state} />

      {wrongPhotos.length > 0 ? (
        <div className="rounded-lg border border-brand-clay bg-brand-clay-tint p-4">
          <h2 className="text-sm font-black text-brand-clay">
            📷 {text(`${wrongPhotos.length} shoe photo(s) not right`, `${wrongPhotos.length} जुत्ताको फोटो मिलेको छैन`)}
          </h2>
          <p className="mt-1 text-sm leading-6 text-brand-clay">
            {text(
              `These shoes are on sale, but customers see the wrong photo — ${wrongPhotos.reduce((total, product) => total + product.stock, 0)} pairs will not sell this way. You can snap and upload right from a phone.`,
              `यी जुत्ता बिक्रीमा छन्, तर ग्राहकले गलत फोटो देख्छन् — ${wrongPhotos.reduce((total, product) => total + product.stock, 0)} जोर जुत्ता यसरी बिक्दैन। मोबाइलबाटै खिचेर हाल्न मिल्छ।`,
            )}
          </p>
          <ul className="mt-2 space-y-1">
            {wrongPhotos.map((product) => (
              <li key={product.id} className="text-sm font-bold text-brand-clay">
                • {product.name} ({text(`${product.stock} pairs`, `${product.stock} जोर`)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-brand-green-line bg-brand-paper">
      <table className="min-w-full divide-y divide-brand-green-line text-sm">
        <thead className="bg-brand-paper-deep">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink"></th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">Product</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">SKU</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">Price</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">Stock</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-brand-green-ink">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-brand-green-line">
          {products.map((product) => (
            <tr key={product.id} className={editingId === product.id ? "bg-brand-mist" : undefined}>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-brand-mist">
                  <SafeImage src={product.image} alt={product.name} fill sizes="48px" className="object-cover" />
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-green-ink">
                {product.name}
                {/* Stock repeated here, under the name, so it is in view on a
                    phone without scrolling the wide table sideways to the Stock
                    column. Clay when there is nothing to sell. */}
                <span
                  className={`mt-1 block text-xs font-semibold ${
                    product.stock > 0 ? "text-brand-muted" : "text-brand-clay"
                  }`}
                >
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
                {/* A stand-in photograph is not a missing one. It looks
                    finished, so nobody goes back to it — which is how three
                    shoes with stock ended up showing a picture of something
                    else. Said here, beside the name, where the fix is one
                    click away. */}
                {isSamplePhoto(product.image) ? (
                  <span className="mt-1 block text-xs font-bold text-brand-clay">
                    ⚠️ {text("Sample photo — not the real shoe", "नमुना फोटो — असली जुत्ताको होइन")}
                  </span>
                ) : hasNoPhoto(product.image) ? (
                  <span className="mt-1 block text-xs font-bold text-brand-clay">
                    ⚠️ {text("No photo", "फोटो छैन")}
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-brand-muted-deep">{product.sku}</td>
              <td className="whitespace-nowrap px-4 py-3 text-brand-muted-deep">{product.price}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex min-w-9 justify-center rounded-full px-2.5 py-1 text-xs font-black ${
                    product.stock > 0
                      ? "bg-brand-green-tint text-brand-green"
                      : "bg-brand-clay-tint text-brand-clay"
                  }`}
                >
                  {product.stock}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={product.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-bold text-brand-green transition hover:bg-brand-mist"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(product)}
                    disabled={isDeleting}
                    aria-label={`Delete ${product.name}`}
                    className="inline-grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
