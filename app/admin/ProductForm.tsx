"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/products";
import type { Product, Category } from "@/lib/products";
import { upsertProductAction, type ActionState } from "./actions";
import ActionMessage from "@/components/admin/ActionMessage";
import ImageUploadField from "@/components/admin/ImageUploadField";

type ProductFormProps = {
  product?: Product | null;
  categories: Category[];
};

/** Rupees as typed, shown the way the storefront will show them. */
function rupeeLabel(rupees: number) {
  return formatPrice(Math.round(rupees * 100));
}

export default function ProductForm({ product, categories }: ProductFormProps) {
  const isEditing = Boolean(product);
  const router = useRouter();
  const [state, setState] = useState<ActionState | null>(null);
  const [pricePreview, setPricePreview] = useState(
    product ? String(product.priceValue / 100) : "",
  );
  const [isSaving, startSaving] = useTransition();

  // Submitted here rather than through `action={...}` so a failure comes back as
  // a message beside the button. The form is never re-rendered from scratch, so
  // every field — and the uploaded photo URL — survives a failed attempt.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startSaving(async () => {
      const result = await upsertProductAction(state, formData);
      setState(result);

      // Pull the saved row back into the list behind the form. Staying on the
      // page is deliberate: the owner sees the confirmation instead of landing
      // somewhere new and wondering whether it went through.
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-brand-paper p-6 shadow-sm">
      <input type="hidden" name="id" defaultValue={product?.id ?? ""} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-brand-green-ink">
            {isEditing ? "Edit product" : "Create product"}
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            {isEditing ? `Updating ${product?.name}` : "Add a new item to the KRISHOE catalog."}
          </p>
        </div>
        {isEditing ? (
          <Link
            href="/admin/products"
            className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
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
        {/* The half of the shop the language switch could never reach: a shoe's
            name comes out of the database, and the database held one. Leaving
            this blank shows the English name to a Nepali shopper, which is what
            the shop did before the column existed — so it can be filled in one
            shoe at a time with nothing broken in between. */}
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">नेपालीमा नाम</span>
          <input
            name="nameNe"
            defaultValue={product?.nameNe ?? ""}
            placeholder="जस्तै: डाक्टर चप्पल"
            className="form-input"
          />
          <span className="text-xs text-brand-muted">
            नलेखे English नाम नै देखिन्छ — Left blank, the English name is shown.
          </span>
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
        {/* Asked for in rupees, stored in paisa.
            This said "Price (paisa)" and expected 179900 for a Rs. 1,799 heel.
            Nobody prices stock in paisa, so the owner typed 5000 for a
            Rs. 5,000 shoe — which would have saved as Rs. 50 and undercut the
            shop by a factor of a hundred, silently, with the form looking
            perfectly filled in. */}
        {/* Shown back as the shopper will see it, while it is being typed.
            The owner reads "priceValue is in paisa" in a report and reasonably
            wonders whether the shop is storing the wrong thing — this answers
            that where the question actually arises, without touching the
            storage, which is in paisa for the same reason every payment system
            is: a rupee held as a decimal loses a paisa to rounding, and fifty
            bills a day is fifty chances for the books not to balance. */}
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">
            मूल्य — रुपैयाँमा <span className="font-normal text-brand-muted">Price (Rs.)</span>
          </span>
          <input
            name="priceRupees"
            defaultValue={product ? product.priceValue / 100 : ""}
            type="number"
            min={0}
            step="0.01"
            required
            className="form-input"
            placeholder="1799"
            onChange={(event) => setPricePreview(event.target.value)}
          />
          <span className="text-xs text-brand-muted">
            {pricePreview.trim() === "" || Number.isNaN(Number(pricePreview))
              ? "ग्राहकले देख्नेछन्: —"
              : `ग्राहकले देख्नेछन्: ${rupeeLabel(Number(pricePreview))}`}
          </span>
        </label>
        {/* Not an input any more. Stock has one door — Operations — and a box
            here was a second one: two answers to "how many pairs are there",
            with nothing to say which was true. The count is shown because it is
            worth seeing while editing a product; it is changed where the pairs
            actually move. */}
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Stock</span>
          <div className="flex min-h-[46px] items-center justify-between gap-3 rounded-lg border border-dashed border-brand-green-line bg-brand-paper-deep px-4">
            <span className="text-lg font-black text-brand-green-ink">
              {product ? `${product.stock} जोडी` : "0 जोडी"}
            </span>
            <Link
              href="/admin/operations"
              className="shrink-0 text-xs font-black text-brand-green underline"
            >
              Operations बाट बदल्ने
            </Link>
          </div>
          <span className="text-xs leading-5 text-brand-muted">
            बनाएको · किनेको · सुरुको बाँकी — सबै Operations बाट। यहाँबाट बदलिँदैन।
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Wholesale Price (Rs.)</span>
          <input
            name="wholesalePriceRupees"
            defaultValue={product?.wholesalePriceValue ? product.wholesalePriceValue / 100 : ""}
            type="number"
            min={0}
            step="0.01"
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
        <span className="text-sm font-medium">नेपालीमा छोटो विवरण</span>
        <textarea
          name="descriptionNe"
          defaultValue={product?.descriptionNe ?? ""}
          rows={2}
          placeholder="जस्तै: दिनभर लगाउँदा खुट्टा दुख्दैन। भिजे पनि बिग्रँदैन।"
          className="form-input"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Long Description</span>
        <textarea name="longDescription" defaultValue={product?.longDescription} rows={4} className="form-input" />
      </label>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ImageUploadField
          name="image"
          label="Main Image"
          initialValue={product?.image ?? ""}
          placeholder="/images/products/… or Upload photo"
        />
        <ImageUploadField
          name="gallery"
          label="Gallery Images"
          initialValue={product?.gallery.join(", ") ?? ""}
          multiple
          placeholder="comma-separated URLs, or Upload photos"
        />
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

      <div className="space-y-4 border-t pt-6">
        <ActionMessage state={state} linkLabel="View all products" />
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Product"}
        </button>
      </div>
    </form>
  );
}
