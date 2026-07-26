import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getProductionWorkOrderDetail } from "@/lib/production-accounting";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminPermission("operations:write");
  const { id } = await params;
  const detail = await getProductionWorkOrderDetail(id);
  if (!detail) return new Response("Work Order not found.", { status: 404 });

  const trackingUrl = new URL(
    `/admin/operations/production-accounts/work-order/${encodeURIComponent(id)}`,
    request.url,
  ).toString();
  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: trackingUrl,
    scale: 4,
    paddingwidth: 6,
    paddingheight: 6,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
