import type { ReactNode } from "react";
import { permanentRedirect } from "next/navigation";
import { getProductById } from "@/lib/product-store";
import { productPath, productSlug } from "@/lib/product-url";

/**
 * An old id link, or a name from before a rename, is sent on to the shoe's
 * address in words here, above loading.tsx: in the page itself the loading
 * screen has already started the answer, so the move would reach the browser
 * as a 200 with a refresh rather than the permanent 308 a search engine needs
 * to move its listing (owner, 2026-10-01). A shoe not found is left to the
 * page, which answers 404.
 */
export default async function ProductAddress({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (product && decodeURIComponent(id).toLowerCase() !== productSlug(product)) {
    permanentRedirect(productPath(product));
  }
  return children;
}
