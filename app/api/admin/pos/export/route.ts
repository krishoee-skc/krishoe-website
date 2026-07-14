import { requireAdminPermission } from "@/lib/admin-permissions";
import { getCostingSnapshot } from "@/lib/costing";
import { csvResponse, toCsv } from "@/lib/csv";
import { getPosSnapshot } from "@/lib/pos";

export const dynamic = "force-dynamic";

const exportTypes = [
  "invoices",
  "items",
  "posting-review",
  "day-close",
  "day-close-detail",
  "profit-close",
] as const;
type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-pos-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "invoices";

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid POS export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  if (type === "profit-close") {
    const costing = await getCostingSnapshot();

    return csvResponse(
      datedFilename("profit-close"),
      toCsv(
        [
          "label",
          "soldPairs",
          "returnedPairs",
          "netPairs",
          "revenue",
          "estimatedCogs",
          "grossProfit",
          "grossMarginRate",
          "missingCostDesigns",
        ],
        costing.periodReports.map((row) => [
          row.label,
          row.soldPairs,
          row.returnedPairs,
          row.netPairs,
          row.revenue,
          row.estimatedCogs,
          row.grossProfit,
          row.grossMarginRate,
          costing.summary.missingCostDesigns,
        ]),
      ),
    );
  }

  const snapshot = await getPosSnapshot();

  if (type === "items") {
    return csvResponse(
      datedFilename("items"),
      toCsv(
        [
          "invoiceNumber",
          "createdAt",
          "channel",
          "kind",
          "sku",
          "design",
          "sizeRun",
          "quantity",
          "rate",
          "discount",
          "lineTotal",
        ],
        snapshot.invoices.flatMap((invoice) =>
          invoice.items.map((item) => [
            invoice.invoiceNumber,
            invoice.createdAt,
            invoice.channel,
            invoice.kind,
            item.sku,
            item.design,
            item.sizeRun,
            item.quantity,
            item.rate,
            item.discount,
            item.lineTotal,
          ]),
        ),
      ),
    );
  }

  if (type === "posting-review") {
    return csvResponse(
      datedFilename("posting-review"),
      toCsv(
        [
          "id",
          "invoiceNumber",
          "createdAt",
          "channel",
          "kind",
          "customerName",
          "total",
          "paidAmount",
          "creditAmount",
          "paymentMethod",
          "postingStatus",
          "expectedStockMovementCount",
          "linkedStockMovementCount",
          "needsLedger",
          "ledgerLinked",
          "signal",
          "issues",
        ],
        snapshot.postingReviewRows.map((row) => [
          row.id,
          row.invoiceNumber,
          row.createdAt,
          row.channel,
          row.kind,
          row.customerName,
          row.total,
          row.paidAmount,
          row.creditAmount,
          row.paymentMethod,
          row.postingStatus,
          row.expectedStockMovementCount,
          row.linkedStockMovementCount,
          row.needsLedger ? "yes" : "no",
          row.ledgerLinked ? "yes" : "no",
          row.signal,
          row.issues,
        ]),
      ),
    );
  }

  if (type === "day-close") {
    return csvResponse(
      datedFilename("day-close"),
      toCsv(
        [
          "date",
          "invoiceCount",
          "saleInvoiceCount",
          "returnInvoiceCount",
          "salesTotal",
          "returnsTotal",
          "netSales",
          "paidAmount",
          "creditAmount",
          "cashAmount",
          "chequeAmount",
          "qrAmount",
          "eSewaAmount",
          "khaltiAmount",
          "bankAmount",
          "postingNeedsReview",
        ],
        snapshot.dayCloseReports.map((row) => [
          row.date,
          row.invoiceCount,
          row.saleInvoiceCount,
          row.returnInvoiceCount,
          row.salesTotal,
          row.returnsTotal,
          row.netSales,
          row.paidAmount,
          row.creditAmount,
          row.cashAmount,
          row.chequeAmount,
          row.qrAmount,
          row.eSewaAmount,
          row.khaltiAmount,
          row.bankAmount,
          row.postingNeedsReview,
        ]),
      ),
    );
  }

  if (type === "day-close-detail") {
    return csvResponse(
      datedFilename("day-close-detail"),
      toCsv(
        [
          "date",
          "section",
          "label",
          "invoiceCount",
          "saleTotal",
          "returnTotal",
          "netTotal",
          "paidAmount",
          "creditAmount",
          "postingNeedsReview",
        ],
        snapshot.dayCloseReports.flatMap((report) => [
          ...report.paymentRows.map((row) => [
            report.date,
            "Payment",
            row.paymentMethod,
            row.invoiceCount,
            row.saleTotal,
            row.returnTotal,
            row.netTotal,
            row.paidAmount,
            row.creditAmount,
            report.postingNeedsReview,
          ]),
          ...report.channelRows.map((row) => [
            report.date,
            "Channel",
            row.channel,
            row.invoiceCount,
            row.saleTotal,
            row.returnTotal,
            row.netTotal,
            "",
            row.creditAmount,
            report.postingNeedsReview,
          ]),
          ...report.cashierRows.map((row) => [
            report.date,
            "Cashier",
            row.cashier,
            row.invoiceCount,
            row.saleTotal,
            row.returnTotal,
            row.netTotal,
            row.paidAmount,
            row.creditAmount,
            report.postingNeedsReview,
          ]),
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("invoices"),
    toCsv(
      [
        "id",
        "invoiceNumber",
        "createdAt",
        "channel",
        "kind",
        "customerName",
        "phone",
        "cashier",
        "paymentMethod",
        "paymentReference",
        "ledgerId",
        "subtotal",
        "discount",
        "tax",
        "total",
        "paidAmount",
        "creditAmount",
        "status",
        "postingStatus",
        "stockMovementIds",
        "ledgerTransactionId",
        "barcodeValue",
        "qrPayload",
        "note",
      ],
      snapshot.invoices.map((invoice) => [
        invoice.id,
        invoice.invoiceNumber,
        invoice.createdAt,
        invoice.channel,
        invoice.kind,
        invoice.customerName,
        invoice.phone,
        invoice.cashier,
        invoice.paymentMethod,
        invoice.paymentReference,
        invoice.ledgerId,
        invoice.subtotal,
        invoice.discount,
        invoice.tax,
        invoice.total,
        invoice.paidAmount,
        invoice.creditAmount,
        invoice.status,
        invoice.postingStatus,
        invoice.stockMovementIds.join("|"),
        invoice.ledgerTransactionId,
        invoice.barcodeValue,
        invoice.qrPayload,
        invoice.note,
      ]),
    ),
  );
}
