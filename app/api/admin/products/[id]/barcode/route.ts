import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProducts } from "@/lib/product-store";

type BarcodeRouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function svgResponse(svg: string) {
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

// A scannable Code128 of a design's SKU, so the shop can print sticker labels
// for the racks and boxes. Scanning one at the counter drops the item into the
// bill (the SKU is what POS matches on).
export async function GET(_request: Request, { params }: BarcodeRouteContext) {
  await requireAdminPermission("products:write");

  const { id } = await params;
  const products = await getProducts({ includeDrafts: true });
  const product = products.find((item) => item.id === id);

  if (!product) {
    return new Response("Product not found.", { status: 404 });
  }

  const code = product.sku || product.id;
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: code,
    scale: 2,
    height: 12,
    paddingwidth: 8,
    paddingheight: 3,
    includetext: true,
    textxalign: "center",
    textsize: 8,
  });

  return svgResponse(svg);
}
