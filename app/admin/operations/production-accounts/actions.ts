"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { bikramMonthKeyOf } from "@/lib/bikram-sambat";
import { refreshFactoryMonthlySummary } from "@/lib/factory-mutations";
import { queryPostgres } from "@/lib/postgres/client";

import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";
import {
  addProductionItem,
  addWorkerPayment,
  approvePackingQcAndPostStock,
  approveProductionCostCard,
  mapProductionItemToCatalog,
  reverseProductionWorkEntry,
  reversePackingQcAndStock,
  reverseWorkerPayment,
  setProductionStageRate,
  setProductionWorkerStageRate,
  setProductionItemMaterial,
} from "@/lib/production-accounting";
import {
  productionStages,
  workerPaymentTypes,
  type ProductionStage,
  type SizeBreakdown,
  type WorkerPaymentType,
} from "@/lib/production-accounting-rules";

const productionTypes = ["Manufactured", "Resale", "Mixed"] as const;
const sizeGroups = ["Baby", "Kids", "Ladies", "Gents", "Mixed"] as const;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function amount(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0;
}

function integer(formData: FormData, key: string) {
  return Math.max(0, Math.round(amount(formData, key)));
}

function option<T extends string>(value: string, choices: readonly T[], fallback: T) {
  return choices.includes(value as T) ? (value as T) : fallback;
}

function sizeBreakdown(value: string): SizeBreakdown {
  if (!value) return {};
  return Object.fromEntries(
    value.split(",").map((part) => {
      const [size, pairs] = part.split(":").map((item) => item.trim());
      if (!size || !pairs || !Number.isFinite(Number(pairs))) {
        throw new Error("Size detail must look like 36:10, 37:15.");
      }
      return [size, Math.max(0, Math.round(Number(pairs)))];
    }),
  );
}

async function ownerContext() {
  const context = await requireAdminPermission("operations:write");
  if (context.role !== "Owner") {
    throw new Error("Only the Owner can approve production wages and worker cash.");
  }
  return {
    approvedBy: context.session.name || context.session.email || "Owner",
  };
}

async function activeEmployee(employeeId: string) {
  const rows = await queryPostgres<{ id: string; name: string; category: string }>(
    "active factory worker",
    `SELECT id, name, category FROM factory_workers WHERE id = $1 AND status = 'active'`,
    [employeeId],
  );
  const worker = rows[0];
  if (!worker) throw new Error("Active worker/staff not found.");
  return { id: worker.id, name: worker.name, department: worker.category, status: "Active" as const };
}

function refresh() {
  revalidatePath("/admin/operations/production-accounts");
  revalidatePath("/admin/factory");
}

export async function createProductionItemAction(formData: FormData) {
  await ownerContext();
  const name = text(formData, "name");
  if (!name) throw new Error("Item name is required.");

  await addProductionItem({
    name,
    category: text(formData, "category"),
    productionType: option(text(formData, "productionType"), productionTypes, "Manufactured"),
    sizeGroup: option(text(formData, "sizeGroup"), sizeGroups, "Mixed"),
    catalogProductId: text(formData, "catalogProductId"),
  });
  await recordAdminAuditEvent("production_item_create", `Production item ${name} created.`);
  refresh();
}

export async function mapProductionItemAction(formData: FormData) {
  await ownerContext();
  const itemId = text(formData, "itemId");
  const catalogProductId = text(formData, "catalogProductId");
  if (!itemId) throw new Error("Production item is required.");

  await mapProductionItemToCatalog(itemId, catalogProductId);
  await recordAdminAuditEvent(
    "production_item_catalog_map",
    `Production item ${itemId} catalog mapping changed to ${catalogProductId || "none"}.`,
  );
  refresh();
}

export async function saveStageRateAction(formData: FormData) {
  await ownerContext();
  const itemId = text(formData, "itemId");
  const stage = option<ProductionStage>(text(formData, "stage"), productionStages, "Upper");
  const ratePerPair = amount(formData, "ratePerPair");
  const effectiveFrom = text(formData, "effectiveFrom");
  if (!itemId || !effectiveFrom) throw new Error("Item and effective date are required.");

  await setProductionStageRate({ itemId, stage, ratePerPair, effectiveFrom });
  await recordAdminAuditEvent(
    "production_stage_rate_save",
    `${stage} wage set to Rs. ${ratePerPair}/pair.`,
  );
  refresh();
}

export async function saveWorkerStageRateAction(formData: FormData) {
  await ownerContext();
  const employee = await activeEmployee(text(formData, "employeeId"));
  const itemId = text(formData, "itemId");
  const stage = option<ProductionStage>(text(formData, "stage"), productionStages, "Upper");
  const ratePerPair = amount(formData, "ratePerPair");
  const effectiveFrom = text(formData, "effectiveFrom");
  if (!itemId || !effectiveFrom) throw new Error("Worker, item and effective date are required.");

  await setProductionWorkerStageRate({
    employee,
    itemId,
    stage,
    ratePerPair,
    effectiveFrom,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_worker_stage_rate_save",
    `${employee.name} special ${stage} wage set to Rs. ${ratePerPair}/pair.`,
  );
  refresh();
}

export async function saveItemMaterialAction(formData: FormData) {
  await ownerContext();
  const itemId = text(formData, "itemId");
  const materialId = text(formData, "materialId");
  if (!itemId || !materialId) throw new Error("Item and raw material are required.");

  await setProductionItemMaterial({
    itemId,
    materialId,
    quantityPerPair: amount(formData, "quantityPerPair"),
    wastagePercent: amount(formData, "wastagePercent"),
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_item_material_save",
    `Material ${materialId} recipe saved for production item ${itemId}.`,
  );
  refresh();
}

export async function approveCostCardAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  const card = await approveProductionCostCard({
    itemId: text(formData, "itemId"),
    effectiveFrom: text(formData, "effectiveFrom"),
    otherDirectCostPerPair: amount(formData, "otherDirectCostPerPair"),
    wholesaleProfitPercent: amount(formData, "wholesaleProfitPercent"),
    retailExtraAmount: amount(formData, "retailExtraAmount"),
    approvedBy,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_cost_card_approve",
    `${card.itemName} cost approved: making Rs. ${card.makingCostPerPair}, wholesale Rs. ${card.wholesalePrice}, retail Rs. ${card.retailPrice}.`,
  );
  refresh();
}

export async function createWorkerPaymentAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  const employee = await activeEmployee(text(formData, "employeeId"));
  const statementStart = text(formData, "statementStart");
  const statementEnd = text(formData, "statementEnd");
  if ((statementStart || statementEnd) && text(formData, "cashConfirmed") !== "yes") {
    throw new Error("Confirm that cash was handed to the worker.");
  }
  const paymentType = option<WorkerPaymentType>(
    text(formData, "paymentType"),
    workerPaymentTypes,
    "Saturday Kharcha",
  );
  const paymentAmount = amount(formData, "amount");
  if (paymentAmount <= 0) throw new Error("Payment amount must be greater than zero.");

  const direction = paymentType === "Bonus" ? "Added" : paymentType === "Deduction" ? "Recovered" : "Paid";
  const suppliedNote = text(formData, "note");
  const statementNote = statementStart && statementEnd
    ? `Statement ${statementStart} to ${statementEnd}`
    : "";
  const receipt = await addWorkerPayment({
    employee,
    paymentDate: text(formData, "paymentDate"),
    paymentType,
    direction,
    amount: paymentAmount,
    approvedBy,
    note: [statementNote, suppliedNote].filter(Boolean).join(" · "),
  });
  // The month this cash belongs to, so the figure Saturday's payment is read
  // from moves with it. Outside addWorkerPayment: refreshFactoryMonthlySummary
  // opens its own transaction and takes the worker lock that one holds.
  //
  // Piece-rate only — monthly staff have no piece summary, and asking for one
  // is refused.
  if (employee.department !== "Staff") {
    try {
      await refreshFactoryMonthlySummary({
        submissionKey: `cash:${receipt}`,
        month: bikramMonthKeyOf(text(formData, "paymentDate")),
        workerId: employee.id,
      });
    } catch {
      // A locked month refuses the rebuild, which is correct — the cash is
      // recorded either way, and a closed month is not rewritten behind the
      // owner's back.
    }
  }

  await recordAdminAuditEvent(
    "worker_cash_approve",
    `${paymentType} Rs. ${paymentAmount} approved for ${employee.name}; ${receipt}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/worker/${employee.id}`);
  refresh();
}

export async function reverseWorkerPaymentAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "reverseConfirmed") !== "yes") {
    throw new Error("Confirm the payment reversal.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear reversal reason (at least 5 characters).");
  }
  const result = await reverseWorkerPayment({
    paymentId: text(formData, "paymentId"),
    reason,
    reversedBy: approvedBy,
  });
  await recordAdminAuditEvent(
    "worker_cash_reverse",
    `${result.receiptNumber} Rs. ${result.amount} reversed for ${result.employeeName}: ${reason}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/worker/${result.employeeId}`);
  refresh();
}

export async function reverseProductionWorkEntryAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "reverseConfirmed") !== "yes") {
    throw new Error("Confirm the work entry reversal.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear reversal reason (at least 5 characters).");
  }
  const result = await reverseProductionWorkEntry({
    entryId: text(formData, "entryId"),
    reason,
    reversedBy: approvedBy,
  });
  // The month the wage is paid from still counted the reversed work. Rebuild
  // it here, after the reversal has committed: refreshFactoryMonthlySummary
  // opens its own transaction and takes the worker lock the reversal held.
  if (result.factoryWorkReversed && result.submissionKey) {
    await refreshFactoryMonthlySummary({
      submissionKey: `reverse:${result.submissionKey}`,
      month: bikramMonthKeyOf(result.workDate),
      workerId: result.employeeId,
    });
  }
  await recordAdminAuditEvent(
    "production_work_reverse",
    `${result.employeeName} wage Rs. ${result.earnedWage} reversed: ${reason}${
      result.factoryWorkReversed ? "; factory work entry and worker ledger reversed too" : ""
    }.`,
  );
  revalidatePath(`/admin/operations/production-accounts/worker/${result.employeeId}`);
  refresh();
}

export async function reversePackingQcAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "reverseConfirmed") !== "yes") {
    throw new Error("Confirm the QC and finished-stock reversal.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear reversal reason (at least 5 characters).");
  }
  const result = await reversePackingQcAndStock({
    postingId: text(formData, "postingId"),
    reason,
    reversedBy: approvedBy,
  });
  await reportingErrors("sync catalog after QC reversal", () =>
    syncProductCatalogStockWithFinishedStock(),
  );
  await recordAdminAuditEvent(
    "production_qc_stock_reverse",
    `${result.approvalReference}: ${result.pairs} ${result.productName} pairs reversed; ${reason}.`,
  );
  revalidatePath("/admin/stock");
  refresh();
}

export async function approvePackingQcAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  const packingEmployeeId = text(formData, "packingEmployeeId");
  const packingEmployee = packingEmployeeId ? await activeEmployee(packingEmployeeId) : undefined;
  const totalPairs = integer(formData, "totalPairs");
  const rejectedPairs = integer(formData, "rejectedPairs");

  const result = await approvePackingQcAndPostStock({
    itemId: text(formData, "itemId"),
    packingEmployee,
    qcDate: text(formData, "qcDate"),
    totalPairs,
    rejectedPairs,
    sizeBreakdown: sizeBreakdown(text(formData, "sizeBreakdown")),
    approvedBy,
    note: text(formData, "note"),
  });

  await reportingErrors("sync catalog after production QC", () =>
    syncProductCatalogStockWithFinishedStock(),
  );
  await recordAdminAuditEvent(
    "production_qc_stock_post",
    `${result.approvalReference}: ${totalPairs} finished pairs posted to stock; ${rejectedPairs} rejected.`,
  );
  refresh();
}
