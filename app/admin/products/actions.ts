"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProducts, setProductCodes, setProductStatus, syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { getFinishedStock } from "@/lib/operations";
import { shoeReadiness } from "@/lib/product-readiness";
import { stockSizesOf } from "@/lib/stock-by-size";
import { codeProblem, codeTakenBy, tidyCode } from "@/lib/shoe-code";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

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

/**
 * Clear every star rating no published review stands behind.
 *
 * Every shoe had been saved with the form's default of 4.8, so all six showed
 * a rating no customer gave, and the self-check marked the menu for it
 * (owner, 2026-09-29). This is the button on that warning: the rating goes to
 * 0 on every shoe — Draft ones too — that has no published review, and stays
 * on any shoe that has one. Pressed by the Owner, recorded in the audit log.
 */
export async function clearUnbackedRatingsAction(): Promise<void> {
  await requireAdminPermission("products:write");
  const cleared = await runWithDataBackend({
    storeName: "products",
    // The local files carry no reviews to compare against; nothing to clear.
    localJson: async () => 0,
    postgres: async () => {
      const rows = await queryPostgres<{ id: string }>(
        "products",
        `UPDATE products p SET rating = '0'
          WHERE COALESCE(p.rating, '0') NOT IN ('0', '')
            AND NOT EXISTS (
              SELECT 1 FROM customer_voice v
               WHERE v.product_id = p.id AND v.kind = 'review' AND v.published = true
            )
          RETURNING p.id`,
      );
      return rows.length;
    },
  });
  await recordAdminAuditEvent(
    "product_ratings_cleared",
    `Star rating cleared on ${cleared} shoe(s) with no published review.`,
  );
  revalidatePath("/", "layout");
}

/** What the drafts panel hears back, in both languages. */
export type PublishState = { ok: boolean; en: string; ne: string };

/**
 * "Put on the shop" from the drafts panel (owner, 2026-10-07). Checked again
 * here, against the stock as it stands now, so a shoe that lost its last pair
 * or its photo since the page opened does not go live.
 */
export async function publishDraftAction(id: string): Promise<PublishState> {
  await requireAdminPermission("products:write");
  const product = (await getProducts({ includeDrafts: true })).find((item) => item.id === id);
  if (!product) return { ok: false, en: "That shoe was not found.", ne: "त्यो जुत्ता भेटिएन।" };
  if (product.status === "Active") return { ok: true, en: `${product.name} is already on the shop.`, ne: `${product.name} पहिल्यै पसलमा छ।` };

  const readiness = shoeReadiness(product, stockSizesOf(await getFinishedStock(), product.name));
  if (!readiness.ready) {
    return {
      ok: false,
      en: `${product.name} still needs ${readiness.blocking.map((need) => need.en).join(", ")}.`,
      ne: `${product.name} मा अझै ${readiness.blocking.map((need) => need.ne).join(", ")} चाहिन्छ।`,
    };
  }

  await setProductStatus(product.id, "Active");
  await recordAdminAuditEvent("product_published", `${product.name} put on the shop from the drafts panel.`);
  revalidatePath("/", "layout");
  return { ok: true, en: `${product.name} is on the shop now.`, ne: `${product.name} अब पसलमा देखिन्छ।` };
}
