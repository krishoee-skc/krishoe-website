"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";

export async function syncProductCatalogStockAction() {
  await requireAdminPermission("products:write");

  const result = await syncProductCatalogStockWithFinishedStock();

  await recordAdminAuditEvent(
    "product_stock_sync",
    `Catalog stock synced: ${result.updatedProducts} updated, ${result.matchedProducts} matched, ${result.unmatchedProducts} unmatched.`,
  );
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/operations");
  revalidatePath("/admin/costing");
  revalidatePath("/shop");

  for (const row of result.rows.filter((item) => item.signal === "Synced")) {
    revalidatePath(`/product/${row.productId}`);
  }

  redirect("/admin/products");
}
