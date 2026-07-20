import { getOperationsDataForReports } from "@/lib/operations";
import { parseOrderTotalRupees } from "@/lib/payment-amount";
import { getPaymentTransactions, type PaymentTransaction } from "@/lib/payment-transactions";
import {
  getOrders,
  paymentProviders,
  paymentStatuses,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/submissions";

export type PaymentReconciliationIssueSeverity = "high" | "medium" | "low";

export type PaymentReconciliationIssue = {
  id: string;
  severity: PaymentReconciliationIssueSeverity;
  type: string;
  orderId?: string;
  transactionId?: string;
  customerName: string;
  amount: number;
  detail: string;
  recommendation: string;
};

type ProviderSummary = {
  provider: PaymentProvider;
  orderCount: number;
  orderAmount: number;
  transactionCount: number;
  transactionAmount: number;
  paidAmount: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
};

type StatusSummary = {
  status: PaymentStatus;
  orderCount: number;
  orderAmount: number;
  transactionCount: number;
  transactionAmount: number;
};

function amountFromOrderTotal(total: string) {
  return parseOrderTotalRupees(total);
}

function daysSince(dateValue: string) {
  const time = new Date(dateValue).getTime();

  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function sortByCreatedAt<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function transactionStatusAmount(summary: ProviderSummary, transaction: PaymentTransaction) {
  if (transaction.paymentStatus === "Paid") {
    summary.paidAmount += transaction.amount;
  }

  if (transaction.paymentStatus === "Pending") {
    summary.pendingAmount += transaction.amount;
  }

  if (transaction.paymentStatus === "Failed") {
    summary.failedAmount += transaction.amount;
  }

  if (transaction.paymentStatus === "Refunded") {
    summary.refundedAmount += transaction.amount;
  }
}

function issue(issue: Omit<PaymentReconciliationIssue, "id">): PaymentReconciliationIssue {
  return {
    ...issue,
    id: [
      issue.severity,
      issue.type,
      issue.orderId ?? "no-order",
      issue.transactionId ?? "no-transaction",
      issue.customerName,
    ]
      .join(":")
      .replaceAll(/\s+/g, "-")
      .toLowerCase(),
  };
}

function duplicateGroups<T>(
  items: T[],
  getKey: (item: T) => string | undefined,
) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item)?.trim();

    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

export async function getPaymentReconciliation() {
  const [orders, transactions, operations] = await Promise.all([
    getOrders(),
    getPaymentTransactions(),
    getOperationsDataForReports(),
  ]);
  const sortedTransactions = sortByCreatedAt(transactions);
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const ledgerIds = new Set(operations.customerLedgers.map((ledger) => ledger.id));
  const ledgerTransactionIds = new Set(operations.ledgerTransactions.map((transaction) => transaction.id));
  const transactionsByOrder = new Map<string, PaymentTransaction[]>();
  const issues: PaymentReconciliationIssue[] = [];

  for (const transaction of sortedTransactions) {
    transactionsByOrder.set(transaction.orderId, [
      ...(transactionsByOrder.get(transaction.orderId) ?? []),
      transaction,
    ]);
  }

  const providerSummary = new Map<PaymentProvider, ProviderSummary>(
    paymentProviders.map((provider) => [
      provider,
      {
        provider,
        orderCount: 0,
        orderAmount: 0,
        transactionCount: 0,
        transactionAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        failedAmount: 0,
        refundedAmount: 0,
      },
    ]),
  );
  const statusSummary = new Map<PaymentStatus, StatusSummary>(
    paymentStatuses.map((status) => [
      status,
      {
        status,
        orderCount: 0,
        orderAmount: 0,
        transactionCount: 0,
        transactionAmount: 0,
      },
    ]),
  );

  const orderRows = orders.map((order) => {
    const orderAmount = amountFromOrderTotal(order.total);
    const orderTransactions = transactionsByOrder.get(order.id) ?? [];
    const latestTransaction = orderTransactions[0];
    const orderProviderSummary = providerSummary.get(order.paymentProvider);
    const orderStatusSummary = statusSummary.get(order.paymentStatus);

    if (orderProviderSummary) {
      orderProviderSummary.orderCount += 1;
      orderProviderSummary.orderAmount += orderAmount;
    }

    if (orderStatusSummary) {
      orderStatusSummary.orderCount += 1;
      orderStatusSummary.orderAmount += orderAmount;
    }

    if (order.paymentStatus === "Paid" && orderTransactions.length === 0) {
      issues.push(
        issue({
          severity: "high",
          type: "Paid order without transaction",
          orderId: order.id,
          customerName: order.name,
          amount: orderAmount,
          detail: "Order is marked Paid but no payment transaction record exists.",
          recommendation: "Add or verify a payment transaction before closing reconciliation.",
        }),
      );
    }

    if (order.paymentStatus === "Paid" && !order.paymentVerifiedAt) {
      issues.push(
        issue({
          severity: "medium",
          type: "Paid order not verified",
          orderId: order.id,
          customerName: order.name,
          amount: orderAmount,
          detail: "Order is Paid but paymentVerifiedAt is empty.",
          recommendation: "Verify provider/admin evidence and save payment details again.",
        }),
      );
    }

    if (
      order.paymentStatus === "Pending" &&
      latestTransaction?.paymentStatus === "Pending" &&
      daysSince(latestTransaction.createdAt) > 3
    ) {
      issues.push(
        issue({
          severity: "medium",
          type: "Stale pending payment",
          orderId: order.id,
          transactionId: latestTransaction.id,
          customerName: order.name,
          amount: latestTransaction.amount,
          detail: `Payment has stayed Pending for ${daysSince(latestTransaction.createdAt)} days.`,
          recommendation: "Contact customer or verify gateway status before dispatching goods.",
        }),
      );
    }

    if (latestTransaction && latestTransaction.paymentStatus !== order.paymentStatus) {
      issues.push(
        issue({
          severity: latestTransaction.paymentStatus === "Paid" ? "high" : "medium",
          type: "Order and transaction status mismatch",
          orderId: order.id,
          transactionId: latestTransaction.id,
          customerName: order.name,
          amount: latestTransaction.amount,
          detail: `Order is ${order.paymentStatus}, latest transaction is ${latestTransaction.paymentStatus}.`,
          recommendation: "Review the latest transaction and align the order payment status.",
        }),
      );
    }

    if (latestTransaction && latestTransaction.paymentProvider !== order.paymentProvider) {
      issues.push(
        issue({
          severity: "medium",
          type: "Payment provider mismatch",
          orderId: order.id,
          transactionId: latestTransaction.id,
          customerName: order.name,
          amount: latestTransaction.amount,
          detail: `Order provider is ${order.paymentProvider}, latest transaction provider is ${latestTransaction.paymentProvider}.`,
          recommendation: "Correct the provider or inspect duplicate payment attempts.",
        }),
      );
    }

    if (
      latestTransaction &&
      orderAmount > 0 &&
      latestTransaction.amount > 0 &&
      latestTransaction.paymentStatus === "Paid" &&
      latestTransaction.amount !== orderAmount
    ) {
      issues.push(
        issue({
          severity: "high",
          type: "Paid amount mismatch",
          orderId: order.id,
          transactionId: latestTransaction.id,
          customerName: order.name,
          amount: latestTransaction.amount,
          detail: `Order total is ${orderAmount}, latest paid transaction is ${latestTransaction.amount}.`,
          recommendation: "Verify invoice total and gateway/admin receipt before marking fulfilled.",
        }),
      );
    }

    if (
      order.paymentStatus === "Paid" &&
      !order.paymentReference &&
      !order.paymentTransactionId &&
      order.paymentProvider !== "cash" &&
      order.paymentProvider !== "cod"
    ) {
      issues.push(
        issue({
          severity: "medium",
          type: "Paid order missing reference",
          orderId: order.id,
          customerName: order.name,
          amount: orderAmount,
          detail: "Paid non-cash order has no reference or transaction id.",
          recommendation: "Record bank/gateway reference for audit.",
        }),
      );
    }

    return {
      id: order.id,
      createdAt: order.createdAt,
      customerName: order.name,
      phone: order.phone,
      total: order.total,
      amount: orderAmount,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      paymentReference: order.paymentReference ?? "",
      paymentTransactionId: order.paymentTransactionId ?? "",
      paymentCallbackId: order.paymentCallbackId ?? "",
      paymentVerifiedAt: order.paymentVerifiedAt ?? "",
      transactionCount: orderTransactions.length,
      latestTransactionId: latestTransaction?.id ?? "",
      latestTransactionStatus: latestTransaction?.paymentStatus ?? "",
      latestTransactionAmount: latestTransaction?.amount ?? 0,
      ledgerId: order.paymentLedgerId ?? "",
      ledgerTransactionId: order.paymentLedgerTransactionId ?? "",
    };
  });

  for (const transaction of sortedTransactions) {
    const provider = providerSummary.get(transaction.paymentProvider);
    const status = statusSummary.get(transaction.paymentStatus);
    const order = orderMap.get(transaction.orderId);

    if (provider) {
      provider.transactionCount += 1;
      provider.transactionAmount += transaction.amount;
      transactionStatusAmount(provider, transaction);
    }

    if (status) {
      status.transactionCount += 1;
      status.transactionAmount += transaction.amount;
    }

    if (!order) {
      issues.push(
        issue({
          severity: "high",
          type: "Transaction without order",
          transactionId: transaction.id,
          customerName: transaction.customerName,
          amount: transaction.amount,
          detail: `Transaction references missing order ${transaction.orderId}.`,
          recommendation: "Restore the order or correct the transaction order id.",
        }),
      );
    }

    if (transaction.paymentStatus === "Paid" && transaction.amount <= 0) {
      issues.push(
        issue({
          severity: "high",
          type: "Paid transaction has zero amount",
          orderId: transaction.orderId,
          transactionId: transaction.id,
          customerName: transaction.customerName,
          amount: transaction.amount,
          detail: "Paid transaction amount is zero.",
          recommendation: "Correct amount from receipt or gateway response.",
        }),
      );
    }

    if (transaction.source === "gateway" && !transaction.paymentCallbackId) {
      issues.push(
        issue({
          severity: "medium",
          type: "Gateway transaction missing callback id",
          orderId: transaction.orderId,
          transactionId: transaction.id,
          customerName: transaction.customerName,
          amount: transaction.amount,
          detail: "Gateway transaction has no callback id for idempotency audit.",
          recommendation: "Check gateway adapter payload mapping.",
        }),
      );
    }

    if (transaction.ledgerId && !ledgerIds.has(transaction.ledgerId)) {
      issues.push(
        issue({
          severity: "high",
          type: "Transaction linked to missing ledger",
          orderId: transaction.orderId,
          transactionId: transaction.id,
          customerName: transaction.customerName,
          amount: transaction.amount,
          detail: `Ledger ${transaction.ledgerId} was not found.`,
          recommendation: "Relink payment to an existing customer ledger.",
        }),
      );
    }

    if (transaction.ledgerTransactionId && !ledgerTransactionIds.has(transaction.ledgerTransactionId)) {
      issues.push(
        issue({
          severity: "high",
          type: "Transaction linked to missing ledger transaction",
          orderId: transaction.orderId,
          transactionId: transaction.id,
          customerName: transaction.customerName,
          amount: transaction.amount,
          detail: `Ledger transaction ${transaction.ledgerTransactionId} was not found.`,
          recommendation: "Relink or recreate the ledger transaction record.",
        }),
      );
    }
  }

  for (const [callbackId, group] of duplicateGroups(orders, (order) => order.paymentCallbackId)) {
    issues.push(
      issue({
        severity: "high",
        type: "Duplicate order callback id",
        orderId: group[0]?.id,
        customerName: group.map((order) => order.name).join(", "),
        amount: sum(group, (order) => amountFromOrderTotal(order.total)),
        detail: `${group.length} orders share callback id ${callbackId}.`,
        recommendation: "Keep callback ids unique to prevent double reconciliation.",
      }),
    );
  }

  for (const [callbackId, group] of duplicateGroups(transactions, (transaction) => transaction.paymentCallbackId)) {
    issues.push(
      issue({
        severity: "high",
        type: "Duplicate transaction callback id",
        orderId: group[0]?.orderId,
        transactionId: group[0]?.id,
        customerName: group.map((transaction) => transaction.customerName).join(", "),
        amount: sum(group, (transaction) => transaction.amount),
        detail: `${group.length} transactions share callback id ${callbackId}.`,
        recommendation: "Review idempotency and keep only legitimate callback trail.",
      }),
    );
  }

  const issueOrderIds = new Set(issues.map((item) => item.orderId).filter(Boolean));
  const transactionRows = sortedTransactions.map((transaction) => ({
    ...transaction,
    orderExists: orderMap.has(transaction.orderId),
    ledgerExists: transaction.ledgerId ? ledgerIds.has(transaction.ledgerId) : true,
    ledgerTransactionExists: transaction.ledgerTransactionId
      ? ledgerTransactionIds.has(transaction.ledgerTransactionId)
      : true,
  }));

  return {
    summary: {
      orderCount: orders.length,
      transactionCount: transactions.length,
      orderAmount: sum(orders, (order) => amountFromOrderTotal(order.total)),
      transactionAmount: sum(transactions, (transaction) => transaction.amount),
      paidOrderAmount: sum(
        orders.filter((order) => order.paymentStatus === "Paid"),
        (order) => amountFromOrderTotal(order.total),
      ),
      paidTransactionAmount: sum(
        transactions.filter((transaction) => transaction.paymentStatus === "Paid"),
        (transaction) => transaction.amount,
      ),
      issueCount: issues.length,
      highRiskIssueCount: issues.filter((item) => item.severity === "high").length,
      gatewayTransactionCount: transactions.filter((transaction) => transaction.source === "gateway").length,
      linkedLedgerTransactionCount: transactions.filter((transaction) => transaction.ledgerId).length,
    },
    providers: [...providerSummary.values()],
    statuses: [...statusSummary.values()],
    issues: issues.sort((left, right) => {
      const severityRank = { high: 0, medium: 1, low: 2 };
      return severityRank[left.severity] - severityRank[right.severity] || right.amount - left.amount;
    }),
    orders: orderRows.map((order) => ({
      ...order,
      hasIssue: issueOrderIds.has(order.id),
    })),
    transactions: transactionRows,
  };
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}
