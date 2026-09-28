"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProducts, setProductCodes, syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { codeProblem, codeTakenBy, tidyCode } from "@/lib/shoe-code";

export async function syncProductCatalogStockAction() {
  await requireAdminPermission("products:write");

  const result = await syncProductCatalogStockWithFinishedStock();

  await recordAdminAuditEvent(
    "product_stock_sync",
    `Catalog stock synced: ${result.updatedProducts} updated, ${result.matchedProducts} matched, ${result.unmatchedProducts} unmatched.`,
  );
  // Layout-wide: the prerendered home and category pages carry stock badges
  // too, and a hand-picked list kept missing them.
  revalidatePath("/", "layout");

  redirect("/admin/products");
}

/** What the codes page hears back. The words are the form's own, in either language. */
export type CodesState =
  | { ok: true; changed: number }
  | { ok: false; problem: "empty" | "looks-like-size" | "clash"; name: string; code: string; other?: string };

/**
 * The codes page: a new code for any number of shoes, saved together.
 *
 * Every code is checked against every other one as it will stand after the
 * save — two shoes answering to one code is how "#205" would ring up the
 * wrong pair — and nothing is written unless all of them pass.
 */
export async function saveProductCodesAction(
  _previousState: CodesState | null,
  formData: FormData,
): Promise<CodesState> {
  await requireAdminPermission("products:write");

  const products = await getProducts({ includeDrafts: true });
  const after = products.map((product) => {
    const typed = formData.get(`code:${product.id}`);
    return { id: product.id, name: product.name, before: product.sku, sku: typeof typed === "string" ? tidyCode(typed) : product.sku };
  });

  for (const row of after) {
    const problem = codeProblem(row.sku);
    if (problem === "empty") {
      return { ok: false, problem: "empty", name: row.name, code: row.sku };
    }
    if (problem === "looks-like-size") {
      return { ok: false, problem: "looks-like-size", name: row.name, code: row.sku };
    }
    const clash = codeTakenBy(after, row.sku, row.id);
    if (clash) {
      return { ok: false, problem: "clash", name: row.name, code: row.sku, other: clash.name };
    }
  }

  const changes = after.filter((row) => row.sku !== row.before);
  if (changes.length === 0) {
    return { ok: true, changed: 0 };
  }

  await setProductCodes(changes.map(({ id, sku }) => ({ id, sku })));
  await recordAdminAuditEvent(
    "product_codes",
    `${changes.length} product codes changed: ${changes.map((row) => `${row.before} → ${row.sku}`).join(", ")}`,
  );
  revalidatePath("/", "layout");

  return { ok: true, changed: changes.length };
}
