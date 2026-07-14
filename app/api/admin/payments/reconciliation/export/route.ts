import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getPaymentReconciliation } from "@/lib/payment-reconciliation";

export const dynamic = "force-dynamic";

const exportTypes = ["issues", "orders", "transactions", "providers"] as const;

type ExportType = (typeof exportTypes)[number];

function isExportType(value: string | null): value is ExportType {
  return exportTypes.includes(value as ExportType);
}

function datedFilename(name: string) {
  return `krishoe-payment-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(request: Request) {
  await requireAdminPermission("exports:read");

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!isExportType(type)) {
    return Response.json(
      { error: "Invalid payment reconciliation export type.", validTypes: exportTypes },
      { status: 400 },
    );
  }

  const reconciliation = await getPaymentReconciliation();

  if (type === "issues") {
    return csvResponse(
      datedFilename("issues"),
      toCsv(
        [
          "id",
          "severity",
          "type",
          "orderId",
          "transactionId",
          "customerName",
          "amount",
          "detail",
          "recommendation",
        ],
        reconciliation.issues.map((issue) => [
          issue.id,
          issue.severity,
          issue.type,
          issue.orderId ?? "",
          issue.transactionId ?? "",
          issue.customerName,
          issue.amount,
          issue.detail,
          issue.recommendation,
        ]),
      ),
    );
  }

  if (type === "orders") {
    return csvResponse(
      datedFilename("orders"),
      toCsv(
        [
          "id",
          "createdAt",
          "customerName",
          "phone",
          "total",
          "amount",
          "orderStatus",
          "paymentStatus",
          "paymentProvider",
          "paymentReference",
          "paymentTransactionId",
          "paymentCallbackId",
          "paymentVerifiedAt",
          "transactionCount",
          "latestTransactionId",
          "latestTransactionStatus",
          "latestTransactionAmount",
          "ledgerId",
          "ledgerTransactionId",
          "hasIssue",
        ],
        reconciliation.orders.map((order) => [
          order.id,
          order.createdAt,
          order.customerName,
          order.phone,
          order.total,
          order.amount,
          order.orderStatus,
          order.paymentStatus,
          order.paymentProvider,
          order.paymentReference,
          order.paymentTransactionId,
          order.paymentCallbackId,
          order.paymentVerifiedAt,
          order.transactionCount,
          order.latestTransactionId,
          order.latestTransactionStatus,
          order.latestTransactionAmount,
          order.ledgerId,
          order.ledgerTransactionId,
          order.hasIssue ? "yes" : "no",
        ]),
      ),
    );
  }

  if (type === "providers") {
    return csvResponse(
      datedFilename("providers"),
      toCsv(
        [
          "provider",
          "orderCount",
          "orderAmount",
          "transactionCount",
          "transactionAmount",
          "paidAmount",
          "pendingAmount",
          "failedAmount",
          "refundedAmount",
        ],
        reconciliation.providers.map((provider) => [
          provider.provider,
          provider.orderCount,
          provider.orderAmount,
          provider.transactionCount,
          provider.transactionAmount,
          provider.paidAmount,
          provider.pendingAmount,
          provider.failedAmount,
          provider.refundedAmount,
        ]),
      ),
    );
  }

  return csvResponse(
    datedFilename("transactions"),
    toCsv(
      [
        "id",
        "createdAt",
        "orderId",
        "customerName",
        "amount",
        "paymentStatus",
        "paymentProvider",
        "paymentReference",
        "paymentTransactionId",
        "paymentCallbackId",
        "ledgerId",
        "ledgerTransactionId",
        "source",
        "orderExists",
        "ledgerExists",
        "ledgerTransactionExists",
        "note",
      ],
      reconciliation.transactions.map((transaction) => [
        transaction.id,
        transaction.createdAt,
        transaction.orderId,
        transaction.customerName,
        transaction.amount,
        transaction.paymentStatus,
        transaction.paymentProvider,
        transaction.paymentReference ?? "",
        transaction.paymentTransactionId ?? "",
        transaction.paymentCallbackId ?? "",
        transaction.ledgerId ?? "",
        transaction.ledgerTransactionId ?? "",
        transaction.source,
        transaction.orderExists ? "yes" : "no",
        transaction.ledgerExists ? "yes" : "no",
        transaction.ledgerTransactionExists ? "yes" : "no",
        transaction.note,
      ]),
    ),
  );
}
