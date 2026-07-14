import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProducts } from "@/lib/product-store";
import { categories } from "@/lib/products";

export async function GET() {
  await requireAdminPermission("products:write");
  const products = await getProducts({ includeDrafts: true });

  return Response.json({
    source: "KRISHOE typed product catalog",
    cmsReady: true,
    categories,
    products,
  });
}
