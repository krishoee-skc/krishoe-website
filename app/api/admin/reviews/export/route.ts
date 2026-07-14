import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getProducts } from "@/lib/product-store";

export const dynamic = "force-dynamic";

function datedFilename() {
  return `krishoe-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET() {
  await requireAdminPermission("exports:read");

  const products = await getProducts({ includeDrafts: true });
  const rows = products.flatMap((product) =>
    product.reviews.map((review) => [
      product.id,
      product.sku,
      product.name,
      review.id,
      review.createdAt,
      review.name,
      review.rating,
      review.comment,
      review.status,
    ]),
  );

  return csvResponse(
    datedFilename(),
    toCsv(
      [
        "productId",
        "productSku",
        "productName",
        "reviewId",
        "createdAt",
        "customerName",
        "rating",
        "comment",
        "status",
      ],
      rows,
    ),
  );
}
