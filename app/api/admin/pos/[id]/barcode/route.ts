import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getPosInvoiceById } from "@/lib/pos";

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

export async function GET(_request: Request, { params }: BarcodeRouteContext) {
  await requireAdminPermission("pos:write");

  const { id } = await params;
  const invoice = await getPosInvoiceById(id);

  if (!invoice) {
    return new Response("POS invoice not found.", { status: 404 });
  }

  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: invoice.barcodeValue || invoice.invoiceNumber,
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
