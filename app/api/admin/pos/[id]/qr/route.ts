import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getPosInvoiceById } from "@/lib/pos";

type QrRouteContext = {
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

export async function GET(_request: Request, { params }: QrRouteContext) {
  await requireAdminPermission("pos:write");

  const { id } = await params;
  const invoice = await getPosInvoiceById(id);

  if (!invoice) {
    return new Response("POS invoice not found.", { status: 404 });
  }

  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: invoice.qrPayload || invoice.invoiceNumber,
    scale: 4,
    paddingwidth: 6,
    paddingheight: 6,
  });

  return svgResponse(svg);
}
