import { getAdminAuditEvents } from "@/lib/admin-audit";
import { getAdminSettingsForBackup } from "@/lib/admin-settings";
import { getCostingSettings } from "@/lib/costing-settings";
import { getSafeDataBackendStatus } from "@/lib/data-backend";
import { getHrData, type HrData } from "@/lib/hr";
import { getNotificationEvents } from "@/lib/notifications";
import { getOperationsData, type OperationsData } from "@/lib/operations";
import { getPaymentTransactions } from "@/lib/payment-transactions";
import { getPasswordResetTokensForBackup } from "@/lib/password-reset-store";
import { getPosInvoices, type PosPaymentMethod } from "@/lib/pos";
import { getProducts } from "@/lib/product-store";
import { getProductionReadinessSummary } from "@/lib/production-readiness";
import { getPurchasingData, type SupplierPaymentMethod } from "@/lib/purchasing";
import { getContactMessages, getOrders } from "@/lib/submissions";
import { getUsersForBackup } from "@/lib/user-store";

export const backupSchemaVersion = 13;

type IdRecord = {
  id: string;
};

function findDuplicateIds(items: IdRecord[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }

    seen.add(item.id);
  }

  return [...duplicates];
}

function findDuplicateNonEmptyValues(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const normalized = value?.trim();

    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.add(normalized);
    }

    seen.add(normalized);
  }

  return [...duplicates];
}

function supplierPaymentTransactionType(paymentMethod: SupplierPaymentMethod) {
  if (paymentMethod === "Cheque") return "Cheque Payment";
  if (paymentMethod === "Bank") return "Bank Payment";
  return "Cash Payment";
}

function posPaymentReferenceRequired(paymentMethod: PosPaymentMethod) {
  return paymentMethod === "Cheque" || paymentMethod === "QR" || paymentMethod === "eSewa" || paymentMethod === "Khalti" || paymentMethod === "Bank";
}

function operationsCounts(operations: OperationsData) {
  return {
    rawMaterials: operations.rawMaterials.length,
    materialConsumptions: operations.materialConsumptions.length,
    workerTasks: operations.workerTasks.length,
    productionBatches: operations.productionBatches.length,
    finishedStock: operations.finishedStock.length,
    vehicleDispatches: operations.vehicleDispatches.length,
    vehicleDispatchItems: operations.vehicleDispatchItems.length,
    customerLedgers: operations.customerLedgers.length,
    stockMovements: operations.stockMovements.length,
    ledgerTransactions: operations.ledgerTransactions.length,
  };
}

function purchasingCounts(purchasing: Awaited<ReturnType<typeof getPurchasingData>>) {
  return {
    supplierLedgers: purchasing.supplierLedgers.length,
    purchaseInvoices: purchasing.purchaseInvoices.length,
    supplierTransactions: purchasing.supplierTransactions.length,
  };
}

function hrCounts(hr: HrData) {
  return {
    employees: hr.employees.length,
    attendanceRecords: hr.attendanceRecords.length,
    payrollRecords: hr.payrollRecords.length,
  };
}

function operationsIntegrity(operations: OperationsData) {
  const ledgerIds = new Set(operations.customerLedgers.map((ledger) => ledger.id));
  const batchIds = new Set(operations.productionBatches.map((batch) => batch.id));
  const materialIds = new Set(operations.rawMaterials.map((material) => material.id));
  const dispatchIds = new Set(operations.vehicleDispatches.map((dispatch) => dispatch.id));
  const stockMovementIds = new Set(operations.stockMovements.map((movement) => movement.id));
  const stockKeys = new Set(
    operations.finishedStock.map((stock) => `${stock.design.toLowerCase()}::${stock.channel}`),
  );

  return {
    duplicateIds: {
      rawMaterials: findDuplicateIds(operations.rawMaterials),
      materialConsumptions: findDuplicateIds(operations.materialConsumptions),
      workerTasks: findDuplicateIds(operations.workerTasks),
      productionBatches: findDuplicateIds(operations.productionBatches),
      finishedStock: findDuplicateIds(operations.finishedStock),
      vehicleDispatches: findDuplicateIds(operations.vehicleDispatches),
      vehicleDispatchItems: findDuplicateIds(operations.vehicleDispatchItems),
      customerLedgers: findDuplicateIds(operations.customerLedgers),
      stockMovements: findDuplicateIds(operations.stockMovements),
      ledgerTransactions: findDuplicateIds(operations.ledgerTransactions),
    },
    orphanLedgerTransactions: operations.ledgerTransactions
      .filter((transaction) => !ledgerIds.has(transaction.ledgerId))
      .map((transaction) => transaction.id),
    orphanMaterialConsumptionBatches: operations.materialConsumptions
      .filter((consumption) => !batchIds.has(consumption.batchId))
      .map((consumption) => consumption.id),
    orphanMaterialConsumptionMaterials: operations.materialConsumptions
      .filter((consumption) => consumption.materialId && !materialIds.has(consumption.materialId))
      .map((consumption) => consumption.id),
    orphanWorkerTaskBatches: operations.workerTasks
      .filter((task) => task.batchId && !batchIds.has(task.batchId))
      .map((task) => task.id),
    orphanVehicleDispatchItems: operations.vehicleDispatchItems
      .filter((item) => !dispatchIds.has(item.dispatchId))
      .map((item) => item.id),
    orphanVehicleDispatchItemStockMovements: operations.vehicleDispatchItems
      .flatMap((item) =>
        item.stockMovementIds
          .filter((movementId) => !stockMovementIds.has(movementId))
          .map((movementId) => `${item.id}:${movementId}`),
      ),
    stockMovementsWithoutStockRow: operations.stockMovements
      .filter((movement) => !stockKeys.has(`${movement.design.toLowerCase()}::${movement.channel}`))
      .map((movement) => movement.id),
    negativeFinishedStock: operations.finishedStock
      .filter((stock) => stock.stockPairs < 0 || stock.soldPairs < 0 || stock.returnedPairs < 0)
      .map((stock) => stock.id),
    invalidVehicleDispatchItems: operations.vehicleDispatchItems
      .filter((item) => item.soldPairs + item.returnedPairs > item.loadedPairs)
      .map((item) => item.id),
  };
}

function hrIntegrity(hr: HrData) {
  const employeeIds = new Set(hr.employees.map((employee) => employee.id));

  return {
    employees: {
      duplicateIds: findDuplicateIds(hr.employees),
    },
    attendanceRecords: {
      duplicateIds: findDuplicateIds(hr.attendanceRecords),
      orphanEmployees: hr.attendanceRecords
        .filter((record) => !employeeIds.has(record.employeeId))
        .map((record) => record.id),
    },
    payrollRecords: {
      duplicateIds: findDuplicateIds(hr.payrollRecords),
      orphanEmployees: hr.payrollRecords
        .filter((record) => !employeeIds.has(record.employeeId))
        .map((record) => record.id),
    },
  };
}

function adminSettingsIntegrity(settings: Awaited<ReturnType<typeof getAdminSettingsForBackup>>) {
  const branchIds = new Set(settings.branches.map((branch) => branch.id));

  return {
    branches: {
      duplicateIds: findDuplicateIds(settings.branches),
      duplicateCodes: findDuplicateNonEmptyValues(settings.branches.map((branch) => branch.code)),
    },
    staff: {
      duplicateIds: findDuplicateIds(settings.staff),
      duplicateEmails: findDuplicateNonEmptyValues(settings.staff.map((staff) => staff.email.toLowerCase())),
      orphanBranches: settings.staff
        .filter((staff) => !branchIds.has(staff.branchId))
        .map((staff) => staff.id),
      activeOwnerCount: settings.staff.filter(
        (staff) => staff.role === "Owner" && staff.status === "Active",
      ).length,
    },
  };
}

export async function buildAdminBackup() {
  const [
    products,
    orders,
    messages,
    users,
    passwordResetTokens,
    operations,
    paymentTransactions,
    posInvoices,
    purchasing,
    costingSettings,
    hr,
    adminSettings,
    audit,
    notifications,
  ] = await Promise.all([
    getProducts({ includeDrafts: true }),
    getOrders(),
    getContactMessages(),
    getUsersForBackup(),
    getPasswordResetTokensForBackup(),
    getOperationsData(),
    getPaymentTransactions(),
    getPosInvoices(),
    getPurchasingData(),
    getCostingSettings(),
    getHrData(),
    getAdminSettingsForBackup(),
    getAdminAuditEvents(500),
    getNotificationEvents(300),
  ]);

  return {
    schemaVersion: backupSchemaVersion,
    exportedAt: new Date().toISOString(),
    source: "KRISHOE admin backup",
    containsSensitiveData: true,
    migrationTarget: "Postgres",
    backend: getSafeDataBackendStatus(),
    counts: {
      products: products.length,
      orders: orders.length,
      messages: messages.length,
      users: users.length,
      passwordResetTokens: passwordResetTokens.length,
      operations: operationsCounts(operations),
      paymentTransactions: paymentTransactions.length,
      posInvoices: posInvoices.length,
      purchasing: purchasingCounts(purchasing),
      costingSettings: 1,
      hr: hrCounts(hr),
      adminSettings: {
        company: 1,
        branches: adminSettings.branches.length,
        staff: adminSettings.staff.length,
      },
      audit: audit.length,
      notifications: notifications.length,
    },
    integrity: {
      products: {
        duplicateIds: findDuplicateIds(products),
      },
      orders: {
        duplicateIds: findDuplicateIds(orders),
        duplicatePaymentCallbackIds: findDuplicateNonEmptyValues(
          orders.map((order) => order.paymentCallbackId),
        ),
        orphanCustomerUserIds: orders
          .filter(
            (order) =>
              order.customerUserId && !users.some((user) => user.id === order.customerUserId),
          )
          .map((order) => order.id),
      },
      messages: {
        duplicateIds: findDuplicateIds(messages),
      },
      users: {
        duplicateIds: findDuplicateIds(users),
      },
      operations: operationsIntegrity(operations),
      paymentTransactions: {
        duplicateIds: findDuplicateIds(paymentTransactions),
        duplicatePaymentCallbackIds: findDuplicateNonEmptyValues(
          paymentTransactions.map((transaction) => transaction.paymentCallbackId),
        ),
        orphanOrderIds: paymentTransactions
          .filter((transaction) => !orders.some((order) => order.id === transaction.orderId))
          .map((transaction) => transaction.id),
        orphanLedgerIds: paymentTransactions
          .filter(
            (transaction) =>
              transaction.ledgerId &&
              !operations.customerLedgers.some((ledger) => ledger.id === transaction.ledgerId),
          )
          .map((transaction) => transaction.id),
        orphanLedgerTransactionIds: paymentTransactions
          .filter(
            (transaction) =>
              transaction.ledgerTransactionId &&
              !operations.ledgerTransactions.some(
                (ledgerTransaction) => ledgerTransaction.id === transaction.ledgerTransactionId,
              ),
          )
          .map((transaction) => transaction.id),
      },
      posInvoices: {
        duplicateIds: findDuplicateIds(posInvoices),
        duplicateInvoiceNumbers: findDuplicateNonEmptyValues(
          posInvoices.map((invoice) => invoice.invoiceNumber),
        ),
        orphanLedgers: posInvoices
          .filter(
            (invoice) =>
              invoice.ledgerId &&
              !operations.customerLedgers.some((ledger) => ledger.id === invoice.ledgerId),
          )
          .map((invoice) => invoice.id),
        orphanLedgerTransactions: posInvoices
          .filter(
            (invoice) =>
              invoice.ledgerTransactionId &&
              !operations.ledgerTransactions.some(
                (transaction) => transaction.id === invoice.ledgerTransactionId,
              ),
          )
          .map((invoice) => invoice.id),
        orphanStockMovements: posInvoices.flatMap((invoice) =>
          invoice.stockMovementIds
            .filter(
              (movementId) =>
                !operations.stockMovements.some((movement) => movement.id === movementId),
            )
            .map((movementId) => `${invoice.id}:${movementId}`),
        ),
        missingExpectedStockMovements: posInvoices
          .filter(
            (invoice) =>
              invoice.status !== "Voided" &&
              invoice.stockMovementIds.filter((movementId) =>
                operations.stockMovements.some((movement) => movement.id === movementId),
              ).length < invoice.items.length,
          )
          .map((invoice) => invoice.id),
        missingRequiredLedgerTransactions: posInvoices
          .filter((invoice) => {
            const needsLedger = (invoice.kind === "Sale" && invoice.creditAmount > 0) || invoice.kind === "Return";

            return (
              needsLedger &&
              (!invoice.ledgerId ||
                !invoice.ledgerTransactionId ||
                !operations.ledgerTransactions.some(
                  (transaction) =>
                    transaction.id === invoice.ledgerTransactionId &&
                    transaction.ledgerId === invoice.ledgerId &&
                    transaction.type === (invoice.kind === "Sale" ? "Credit Sale" : "Return Adjustment") &&
                    transaction.amount === (invoice.kind === "Sale" ? invoice.creditAmount : invoice.total),
                ))
            );
          })
          .map((invoice) => invoice.id),
        invalidCreditPaidInvoices: posInvoices
          .filter((invoice) => invoice.paymentMethod === "Credit" && invoice.paidAmount > 0)
          .map((invoice) => invoice.id),
        missingPaymentReferences: posInvoices
          .filter(
            (invoice) =>
              posPaymentReferenceRequired(invoice.paymentMethod) &&
              invoice.paidAmount > 0 &&
              !invoice.paymentReference,
          )
          .map((invoice) => invoice.id),
      },
      purchasing: {
        supplierLedgers: {
          duplicateIds: findDuplicateIds(purchasing.supplierLedgers),
        },
        purchaseInvoices: {
          duplicateIds: findDuplicateIds(purchasing.purchaseInvoices),
          duplicatePurchaseNumbers: findDuplicateNonEmptyValues(
            purchasing.purchaseInvoices.map((invoice) => invoice.purchaseNumber),
          ),
          orphanSupplierLedgers: purchasing.purchaseInvoices
            .filter(
              (invoice) =>
                !purchasing.supplierLedgers.some(
                  (supplier) => supplier.id === invoice.supplierLedgerId,
                ),
            )
            .map((invoice) => invoice.id),
          orphanRawMaterials: purchasing.purchaseInvoices
            .filter(
              (invoice) =>
                !operations.rawMaterials.some((material) => material.id === invoice.materialId),
            )
            .map((invoice) => invoice.id),
          orphanSupplierTransactions: purchasing.purchaseInvoices.flatMap((invoice) =>
            invoice.supplierTransactionIds
              .filter(
                (transactionId) =>
                  !purchasing.supplierTransactions.some(
                    (transaction) => transaction.id === transactionId,
                  ),
              )
              .map((transactionId) => `${invoice.id}:${transactionId}`),
          ),
          missingPurchaseBillTransactions: purchasing.purchaseInvoices
            .filter(
              (invoice) =>
                !invoice.supplierTransactionIds.some((transactionId) =>
                  purchasing.supplierTransactions.some(
                    (transaction) =>
                      transaction.id === transactionId &&
                      transaction.type === "Purchase Bill" &&
                      transaction.amount === invoice.total,
                  ),
                ),
            )
            .map((invoice) => invoice.id),
          missingPaymentTransactions: purchasing.purchaseInvoices
            .filter(
              (invoice) =>
                invoice.paymentMethod !== "Credit" &&
                invoice.paidAmount > 0 &&
                !invoice.supplierTransactionIds.some((transactionId) =>
                  purchasing.supplierTransactions.some(
                    (transaction) =>
                      transaction.id === transactionId &&
                      transaction.type === supplierPaymentTransactionType(invoice.paymentMethod) &&
                      transaction.amount === invoice.paidAmount,
                  ),
                ),
            )
            .map((invoice) => invoice.id),
          invalidCreditPaidInvoices: purchasing.purchaseInvoices
            .filter((invoice) => invoice.paymentMethod === "Credit" && invoice.paidAmount > 0)
            .map((invoice) => invoice.id),
        },
        supplierTransactions: {
          duplicateIds: findDuplicateIds(purchasing.supplierTransactions),
          orphanSupplierLedgers: purchasing.supplierTransactions
            .filter(
              (transaction) =>
                !purchasing.supplierLedgers.some(
                  (supplier) => supplier.id === transaction.supplierLedgerId,
                ),
            )
            .map((transaction) => transaction.id),
        },
      },
      hr: hrIntegrity(hr),
      adminSettings: adminSettingsIntegrity(adminSettings),
    },
    migrationReadiness: {
      recommendedOrder: [
        "Export this backup before every migration attempt.",
        "Create Postgres tables from docs/schema.sql.",
        "Import lookup/master rows first: products, users, ledgers, raw materials, stock.",
        "Import transaction rows next: orders, messages, production, dispatches, stock movements, ledger transactions, payment transactions.",
        "Import POS invoices after their stock movement and ledger transaction links exist.",
        "Import supplier ledgers, supplier transactions, and purchase invoices with their raw material links.",
        "Import costing settings so labor and overhead COGS stay consistent.",
        "Import HR employees before attendance and payroll records.",
        "Import company branches and admin staff before switching staff login to production.",
        "Run integrity checks and compare counts with this backup.",
        "Switch DATA_BACKEND to postgres only after read/write smoke tests pass.",
      ],
      productionReadiness: getProductionReadinessSummary(),
    },
    data: {
      products,
      orders,
      messages,
      users,
      passwordResetTokens,
      operations,
      paymentTransactions,
      posInvoices,
      purchasing,
      costingSettings,
      hr,
      adminSettings,
      audit,
      notifications,
    },
  };
}
