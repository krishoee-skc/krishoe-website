"use server";

import { z } from "zod";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { draftProductCopy, isAiConfigured, type DraftResult } from "@/lib/ai/product-copy";
import type { Product } from "@/lib/products";

/**
 * The one door between the product form and the AI.
 *
 * It takes what is typed in the form rather than a saved product id, so the
 * owner can add a new pair, type its name and price, and have the rest drafted
 * before anything exists in the database. That is the whole point: the empty
 * fields are hardest to fill on a phone, and they are the ones he skips.
 *
 * Nothing here writes. The draft goes back to the browser and sits in the form
 * inputs until he presses the Save that has always been there — so an answer he
 * dislikes costs him a page refresh, not an undo.
 */

const draftInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).default(""),
  price: z.string().trim().max(40).default(""),
  material: z.string().trim().max(120).default(""),
  fit: z.string().trim().max(120).default(""),
  colors: z.string().trim().max(200).default(""),
  sizes: z.string().trim().max(200).default(""),
  badge: z.string().trim().max(60).default(""),
  /** Which fields to draft. Empty means every field still blank in the form. */
  fields: z.array(z.string()).max(20).default([]),
});

export type DraftInput = z.input<typeof draftInput>;

/** Splits "Black, Brown" the way the form's own save does. */
function list(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function draftProductCopyAction(input: DraftInput): Promise<DraftResult> {
  // Same permission as saving the product. Someone who may not edit the catalog
  // has no reason to spend the shop's AI quota on it either.
  await requireAdminPermission("products:write");

  if (!isAiConfigured()) {
    return {
      ok: false,
      reason: { en: "AI is not connected", ne: "AI जोडिएको छैन" },
      detail: "GEMINI_API_KEY is not set on this deployment. Everything else on this form works.",
    };
  }

  const parsed = draftInput.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      reason: { en: "The shoe needs a name first", ne: "जुत्ताको नाम चाहिन्छ" },
      detail: "A draft needs at least the product name to work from.",
    };
  }

  const form = parsed.data;

  /**
   * A Product built only from what the form holds.
   *
   * The unused halves are filled with empties rather than borrowed from a saved
   * row, so a field the owner has not typed reads as blank to the drafter — and
   * blank is what makes it eligible for drafting. Only the fields listed in
   * `describe()` inside lib/ai/product-copy.ts ever leave the server.
   */
  const product = {
    id: "",
    sku: "",
    name: form.name,
    category: form.category,
    categorySlug: "",
    price: form.price,
    priceValue: 0,
    wholesalePriceValue: 0,
    minWholesaleQty: 0,
    image: "",
    gallery: [],
    badge: form.badge,
    rating: "",
    description: "",
    longDescription: "",
    material: form.material,
    fit: form.fit,
    colors: list(form.colors),
    sizes: list(form.sizes),
    stock: 0,
    highlights: [],
    care: [],
    reviews: [],
    status: "Draft",
    featured: false,
    bestSeller: false,
    newArrival: false,
  } as unknown as Product;

  const result = await draftProductCopy(
    product,
    form.fields.length ? (form.fields as Parameters<typeof draftProductCopy>[1]) : undefined,
  );

  // Logged whether it worked or not. A quota that runs out at eleven in the
  // morning is a thing the owner should be able to see afterwards, and an AI
  // action nobody can account for is one nobody can audit.
  await recordAdminAuditEvent(
    "product_ai_draft",
    result.ok
      ? `AI drafted ${Object.keys(result.draft).join(", ")} for "${form.name}" (${result.model}, ${result.tookMs}ms). Not saved.`
      : `AI draft for "${form.name}" produced nothing: ${result.detail}`,
    result.ok ? "success" : "warning",
  );

  return result;
}
