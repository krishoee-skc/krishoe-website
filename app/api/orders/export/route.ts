import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { buildOnlineOrderConversionReport } from "@/lib/order-pos";
import { getOperationsData } from "@/lib/operations";
import { getPosInvoices } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { getOrders } from "@/lib/submissions";

export const dynamic = "force-dynamic";

const exportTypes = ["orders", "conversion"] as const;
type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-orders-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "orders";

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid order export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  const orders = await getOrders();

  if (type === "conversion") {
    const [operations, posInvoices, products] = await Promise.all([
      getOperationsData(),
      getPosInvoices(),
      getProducts({ includeDrafts: true }),
    ]);
    const conversionReport = buildOnlineOrderConversionReport({
      orders,
      products,
      finishedStock: operations.finishedStock,
      posInvoices,
    });

    await appendAdminAuditEvent(
      "order_conversion_export",
      `${conversionReport.rows.length} online order conversion rows exported as CSV.`,
    ).catch(() => undefined);

    return csvResponse(
      datedFilename("conversion"),
      toCsv(
        [
          "orderId",
          "createdAt",
          "customerName",
          "total",
          "itemCount",
          "pairCount",
          "parsed",
          "converted",
          "posInvoiceId",
          "posInvoiceNumber",
          "missingLedger",
          "missingStockItems",
          "signal",
          "detail",
        ],
        conversionReport.rows.map((row) => [
          row.orderId,
          row.createdAt,
          row.customerName,
          row.total,
          row.itemCount,
          row.pairCount,
          row.parsed ? "yes" : "no",
          row.converted ? "yes" : "no",
          row.posInvoiceId,
          row.posInvoiceNumber,
          row.missingLedger ? "yes" : "no",
          row.missingStockItems.join("|"),
          row.signal,
          row.detail,
        ]),
      ),
    );
  }

  await appendAdminAuditEvent("order_export", `${orders.length} order rows exported as CSV.`).catch(
    () => undefined,
  );
  const csv = toCsv(
    [
      "id",
      "createdAt",
      "customerUserId",
      "name",
      "phone",
      "address",
      "delivery",
      "payment",
      "order",
      "total",
      "status",
      "paymentStatus",
      "paymentProvider",
      "paymentReference",
      "paymentTransactionId",
      "paymentCallbackId",
      "paymentVerifiedAt",
      "paymentLedgerId",
      "paymentLedgerTransactionId",
    ],
    orders.map((order) => [
      order.id,
      order.createdAt,
      order.customerUserId ?? "",
      order.name,
      order.phone,
      order.address,
      order.delivery,
      order.payment,
      order.order,
      order.total,
      order.status,
      order.paymentStatus,
      order.paymentProvider,
      order.paymentReference ?? "",
      order.paymentTransactionId ?? "",
      order.paymentCallbackId ?? "",
      order.paymentVerifiedAt ?? "",
      order.paymentLedgerId ?? "",
      order.paymentLedgerTransactionId ?? "",
    ]),
  );

  return csvResponse(datedFilename("orders"), csv);
}
