"use client";

import Link from "next/link";
import type { Product, Category } from "@/lib/products";
import { upsertProductAction } from "./actions";
import SubmitButton from "@/components/SubmitButton";

type ProductFormProps = {
  product?: Product | null;
  categories: Category[];
};

export default function ProductForm({ product, categories }: ProductFormProps) {
  const isEditing = Boolean(product);

  return (
    <form action={upsertProductAction} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
      <input type="hidden" name="id" defaultValue={product?.id ?? ""} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#10231D]">
            {isEditing ? "Edit product" : "Create product"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isEditing ? `Updating ${product?.name}` : "Add a new item to the KRISHOE catalog."}
          </p>
        </div>
        {isEditing ? (
          <Link
            href="/admin/products"
            className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold text-[#0B4D3B] transition hover:bg-[#F5F7F4]"
          >
            Cancel edit
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Product Name</span>
          <input name="name" defaultValue={product?.name} required className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">SKU</span>
          <input name="sku" defaultValue={product?.sku} required className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Category</span>
          <select name="categorySlug" defaultValue={product?.categorySlug} className="form-input">
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Price (paisa)</span>
          <input name="priceValue" defaultValue={product?.priceValue} type="number" required className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Stock</span>
          <input name="stock" defaultValue={product?.stock} type="number" required className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Wholesale Price (paisa)</span>
          <input
            name="wholesalePriceValue"
            defaultValue={product?.wholesalePriceValue ?? 0}
            type="number"
            min={0}
            className="form-input"
            placeholder="0 = no wholesale rate"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Min Wholesale Qty (pairs)</span>
          <input
            name="minWholesaleQty"
            defaultValue={product?.minWholesaleQty ?? 1}
            type="number"
            min={1}
            className="form-input"
            placeholder="1"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Badge</span>
          <input name="badge" defaultValue={product?.badge ?? ""} className="form-input" placeholder="New, Limited, Premium" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Rating</span>
          <input name="rating" defaultValue={product?.rating ?? "4.8"} className="form-input" />
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Short Description</span>
        <textarea name="description" defaultValue={product?.description} rows={2} className="form-input" />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Long Description</span>
        <textarea name="longDescription" defaultValue={product?.longDescription} rows={4} className="form-input" />
      </label>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Main Image URL</span>
          <input name="image" defaultValue={product?.image} className="form-input" placeholder="/images/products/..." />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Gallery URLs (comma-separated)</span>
          <input name="gallery" defaultValue={product?.gallery.join(", ")} className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Colors (comma-separated)</span>
          <input name="colors" defaultValue={product?.colors.join(", ")} className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Sizes (comma-separated)</span>
          <input name="sizes" defaultValue={product?.sizes.join(", ")} className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Material</span>
          <input name="material" defaultValue={product?.material} className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Fit</span>
          <input name="fit" defaultValue={product?.fit} className="form-input" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Highlights (comma-separated)</span>
          <textarea name="highlights" defaultValue={product?.highlights.join(", ")} rows={3} className="form-input" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Care Instructions (comma-separated)</span>
          <textarea name="care" defaultValue={product?.care.join(", ")} rows={3} className="form-input" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-8">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Status</span>
          <select name="status" defaultValue={product?.status ?? "Active"} className="form-input">
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
          </select>
        </label>
        <div className="flex items-center gap-8 pt-5">
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={product?.featured} /> Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="bestSeller" defaultChecked={product?.bestSeller} /> Best Seller</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="newArrival" defaultChecked={product?.newArrival} /> New Arrival</label>
        </div>
      </div>

      <div className="border-t pt-6">
        <SubmitButton
          idleLabel={isEditing ? "Save Changes" : "Create Product"}
          pendingLabel={isEditing ? "Saving..." : "Creating..."}
        />
      </div>
    </form>
  );
}
