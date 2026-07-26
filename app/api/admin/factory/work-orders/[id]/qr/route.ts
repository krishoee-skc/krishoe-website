import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  factoryWorkOrderTraceUrl,
  getFactoryData,
} from "@/lib/factory";

type QrRouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: QrRouteContext) {
  await requireAdminPermission("factory:write");
  const { id } = await params;
  const factory = await getFactoryData();
  const workOrder = factory.workOrders.find((entry) => entry.id === id);

  if (!workOrder) {
    return new Response("Factory Work Order not found.", { status: 404 });
  }

  const traceUrl = factoryWorkOrderTraceUrl(request.url, workOrder.id);
  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: traceUrl,
    scale: 4,
    paddingwidth: 6,
    paddingheight: 6,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="${workOrder.workOrderNumber}-qr.svg"`,
    },
  });
}
