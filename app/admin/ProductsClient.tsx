"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Product } from "@/lib/products";
import { PencilIcon, TrashIcon } from "@/components/Icons";
import ActionMessage from "@/components/admin/ActionMessage";
import { deleteProductAction, type ActionState } from "@/app/admin/actions";

function StatusBadge({ status }: { status: string }) {
  const baseClasses = "rounded-full px-2.5 py-1 text-xs font-semibold";
  switch (status.toLowerCase()) {
    case "active":
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>Active</span>;
    case "draft":
      return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Draft</span>;
    default:
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
  }
}

type ProductsClientProps = {
  products: Product[];
  editingId?: string | null;
};

export default function ProductsClient({ products, editingId = null }: ProductsClientProps) {
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
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <h2 className="text-lg font-black text-brand-green-ink">No products yet</h2>
        <p className="mt-2 text-sm text-gray-500">Create your first product from the form above.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <ActionMessage state={state} />
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900"></th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Product</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">SKU</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Price</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Stock</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-900">Status</th>
            <th className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id} className={editingId === product.id ? "bg-brand-mist" : undefined}>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-gray-100">
                  <Image src={product.image} alt={product.name} fill sizes="48px" className="object-cover" />
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{product.name}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700">{product.sku}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-700">{product.price}</td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                {product.stock}
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
