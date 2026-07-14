import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getProducts } from "@/lib/product-store";

const productCsvHeaders = [
  "id",
  "sku",
  "name",
  "categorySlug",
  "priceValue",
  "stock",
  "status",
  "badge",
  "rating",
  "image",
  "gallery",
  "colors",
  "sizes",
  "description",
  "longDescription",
  "material",
  "fit",
  "highlights",
  "care",
  "featured",
  "bestSeller",
  "newArrival",
];

export async function GET() {
  await requireAdminPermission("exports:read");

  const products = await getProducts({ includeDrafts: true });
  await appendAdminAuditEvent(
    "product_export",
    `${products.length} product rows exported as CSV.`,
  ).catch(() => undefined);
  const csv = toCsv(
    productCsvHeaders,
    products.map((product) => [
      product.id,
      product.sku,
      product.name,
      product.categorySlug,
      product.priceValue,
      product.stock,
      product.status,
      product.badge ?? "",
      product.rating,
      product.image,
      product.gallery.join(", "),
      product.colors.join(", "),
      product.sizes.join(", "),
      product.description,
      product.longDescription,
      product.material,
      product.fit,
      product.highlights.join(", "),
      product.care.join(", "),
      product.featured ? "true" : "false",
      product.bestSeller ? "true" : "false",
      product.newArrival ? "true" : "false",
    ]),
  );

  return csvResponse("krishoe-products.csv", csv);
}
