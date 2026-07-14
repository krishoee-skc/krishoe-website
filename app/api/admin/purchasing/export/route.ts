import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getPurchasingSnapshot } from "@/lib/purchasing";

export const dynamic = "force-dynamic";

const exportTypes = [
  "invoices",
  "suppliers",
  "supplier-aging",
  "supplier-payables",
  "transactions",
  "materials",
  "posting-review",
] as const;
type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-purchasing-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "invoices";

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid purchasing export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  const snapshot = await getPurchasingSnapshot();

  if (type === "suppliers") {
    return csvResponse(
      datedFilename("suppliers"),
      toCsv(
        [
          "id",
          "supplierName",
          "phone",
          "materialFocus",
          "totalPurchase",
          "paidAmount",
          "balanceDue",
          "lastTransaction",
        ],
        snapshot.supplierLedgers.map((supplier) => [
          supplier.id,
          supplier.supplierName,
          supplier.phone,
          supplier.materialFocus,
          supplier.totalPurchase,
          supplier.paidAmount,
          supplier.balanceDue,
          supplier.lastTransaction,
        ]),
      ),
    );
  }

  if (type === "transactions") {
    return csvResponse(
      datedFilename("transactions"),
      toCsv(
        ["id", "createdAt", "supplierLedgerId", "supplierName", "type", "amount", "note"],
        snapshot.supplierTransactions.map((transaction) => [
          transaction.id,
          transaction.createdAt,
          transaction.supplierLedgerId,
          transaction.supplierName,
          transaction.type,
          transaction.amount,
          transaction.note,
        ]),
      ),
    );
  }

  if (type === "supplier-aging") {
    return csvResponse(
      datedFilename("supplier-aging"),
      toCsv(
        [
          "supplierLedgerId",
          "supplierName",
          "phone",
          "materialFocus",
          "balanceDue",
          "current0To30",
          "days31To60",
          "days61To90",
          "over90",
          "agedTotal",
          "reconciliationDelta",
          "oldestOpenDate",
          "oldestOpenDays",
          "openItemCount",
          "risk",
          "lastTransaction",
        ],
        snapshot.reports.supplierAgingRows.map((row) => [
          row.supplierLedgerId,
          row.supplierName,
          row.phone,
          row.materialFocus,
          row.balanceDue,
          row.current,
          row.days31To60,
          row.days61To90,
          row.over90,
          row.agedTotal,
          row.reconciliationDelta,
          row.oldestOpenDate,
          row.oldestOpenDays,
          row.openItemCount,
          row.risk,
          row.lastTransaction,
        ]),
      ),
    );
  }

  if (type === "supplier-payables") {
    return csvResponse(
      datedFilename("supplier-payables"),
      toCsv(
        [
          "supplierLedgerId",
          "supplierName",
          "phone",
          "materialFocus",
          "balanceDue",
          "current0To30",
          "days31To60",
          "days61To90",
          "over90",
          "oldestOpenDate",
          "oldestOpenDays",
          "risk",
          "priority",
          "paymentDueDate",
          "nextAction",
        ],
        snapshot.reports.supplierPaymentFollowups.map((row) => [
          row.supplierLedgerId,
          row.supplierName,
          row.phone,
          row.materialFocus,
          row.balanceDue,
          row.current,
          row.days31To60,
          row.days61To90,
          row.over90,
          row.oldestOpenDate,
          row.oldestOpenDays,
          row.risk,
          row.priority,
          row.paymentDueDate,
          row.nextAction,
        ]),
      ),
    );
  }

  if (type === "materials") {
    return csvResponse(
      datedFilename("materials"),
      toCsv(
        ["materialName", "quantity", "total", "invoiceCount"],
        snapshot.reports.materialTotals.map((material) => [
          material.materialName,
          material.quantity,
          material.total,
          material.invoiceCount,
        ]),
      ),
    );
  }

  if (type === "posting-review") {
    return csvResponse(
      datedFilename("posting-review"),
      toCsv(
        [
          "id",
          "purchaseNumber",
          "supplierName",
          "materialName",
          "quantity",
          "total",
          "paidAmount",
          "creditAmount",
          "paymentMethod",
          "postingStatus",
          "expectedTransactionCount",
          "linkedTransactionCount",
          "supplierExists",
          "materialExists",
          "billPosted",
          "paymentPosted",
          "signal",
          "issues",
        ],
        snapshot.reports.postingReviewRows.map((row) => [
          row.id,
          row.purchaseNumber,
          row.supplierName,
          row.materialName,
          row.quantity,
          row.total,
          row.paidAmount,
          row.creditAmount,
          row.paymentMethod,
          row.postingStatus,
          row.expectedTransactionCount,
          row.linkedTransactionCount,
          row.supplierExists ? "yes" : "no",
          row.materialExists ? "yes" : "no",
          row.billPosted ? "yes" : "no",
          row.paymentPosted ? "yes" : "no",
          row.signal,
          row.issues,
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("invoices"),
    toCsv(
      [
        "id",
        "purchaseNumber",
        "createdAt",
        "supplierLedgerId",
        "supplierName",
        "materialId",
        "materialName",
        "unit",
        "quantity",
        "rate",
        "discount",
        "tax",
        "total",
        "paidAmount",
        "creditAmount",
        "paymentMethod",
        "paymentReference",
        "status",
        "postingStatus",
        "supplierTransactionIds",
        "note",
      ],
      snapshot.purchaseInvoices.map((invoice) => [
        invoice.id,
        invoice.purchaseNumber,
        invoice.createdAt,
        invoice.supplierLedgerId,
        invoice.supplierName,
        invoice.materialId,
        invoice.materialName,
        invoice.unit,
        invoice.quantity,
        invoice.rate,
        invoice.discount,
        invoice.tax,
        invoice.total,
        invoice.paidAmount,
        invoice.creditAmount,
        invoice.paymentMethod,
        invoice.paymentReference,
        invoice.status,
        invoice.postingStatus,
        invoice.supplierTransactionIds.join("|"),
        invoice.note,
      ]),
    ),
  );
}
