"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getHrData } from "@/lib/hr";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";
import { reportingErrors } from "@/lib/report-error";
import {
  addApprovedWorkEntry,
  addProductionCctvReference,
  addProductionItem,
  addWorkOrderMaterialConsumption,
  addWorkerPayment,
  approvePackingQcAndPostStock,
  approveProductionCostCard,
  cancelProductionWorkOrder,
  createProductionWorkOrder,
  createProductionHandover,
  mapProductionItemToCatalog,
  reverseProductionWorkEntry,
  reversePackingQcAndStock,
  reverseProductionHandover,
  reverseWorkOrderMaterialConsumption,
  reverseWorkerPayment,
  setProductionStageRate,
  setProductionWorkerStageRate,
  setProductionItemMaterial,
  updateProductionWorkOrderSchedule,
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

async function factoryEntryContext() {
  const context = await requireAdminPermission("production:entry");
  return {
    approvedBy: context.session.name || context.session.email || context.role,
  };
}

async function activeEmployee(employeeId: string) {
  const hr = await getHrData();
  const employee = hr.employees.find((row) => row.id === employeeId && row.status === "Active");
  if (!employee) throw new Error("Active worker/staff not found.");
  return employee;
}

function refresh() {
  revalidatePath("/admin/operations/production-accounts");
  revalidatePath("/admin/factory");
}

function nepalTimestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Valid camera date and time are required.");
  }
  return `${value}:00+05:45`;
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

export async function createWorkOrderAction(formData: FormData) {
  const { approvedBy } = await factoryEntryContext();
  const order = await createProductionWorkOrder({
    itemId: text(formData, "itemId"),
    colour: text(formData, "colour"),
    sizeBreakdown: sizeBreakdown(text(formData, "sizeBreakdown")),
    plannedPairs: integer(formData, "plannedPairs"),
    dueDate: text(formData, "dueDate"),
    priority: option(text(formData, "priority"), ["Normal", "High", "Urgent"] as const, "Normal"),
    createdBy: approvedBy,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_work_order_create",
    `${order.workOrderNumber}: ${order.itemName}, ${order.plannedPairs} pairs created.`,
  );
  refresh();
}

export async function updateWorkOrderScheduleAction(formData: FormData) {
  await ownerContext();
  const result = await updateProductionWorkOrderSchedule({
    workOrderId: text(formData, "workOrderId"),
    dueDate: text(formData, "dueDate"),
    priority: option(text(formData, "priority"), ["Normal", "High", "Urgent"] as const, "Normal"),
  });
  await recordAdminAuditEvent(
    "production_work_order_schedule",
    `${result.workOrderNumber} due date/priority updated.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${text(formData, "workOrderId")}`);
  refresh();
}

export async function createCctvReferenceAction(formData: FormData) {
  const { approvedBy } = await factoryEntryContext();
  const workOrderId = text(formData, "workOrderId");
  const stage = option<ProductionStage | "Packing / QC">(
    text(formData, "stage"),
    [...productionStages, "Packing / QC"] as const,
    "Upper",
  );
  const result = await addProductionCctvReference({
    workOrderId,
    stage,
    cameraZone: text(formData, "cameraZone"),
    windowStart: nepalTimestamp(text(formData, "windowStart")),
    windowEnd: nepalTimestamp(text(formData, "windowEnd")),
    cctvReference: text(formData, "cctvReference"),
    evidenceReference: text(formData, "evidenceReference"),
    recordedBy: approvedBy,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_cctv_reference_create",
    `${result.work_order_number} ${stage} camera reference saved.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${workOrderId}`);
  refresh();
}

export async function cancelWorkOrderAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "cancelConfirmed") !== "yes") {
    throw new Error("Confirm the Work Order cancellation.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear cancellation reason (at least 5 characters).");
  }
  const result = await cancelProductionWorkOrder({
    workOrderId: text(formData, "workOrderId"),
    reason,
    cancelledBy: approvedBy,
  });
  await recordAdminAuditEvent(
    "production_work_order_cancel",
    `${result.workOrderNumber} cancelled: ${reason}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${text(formData, "workOrderId")}`);
  refresh();
}

export async function createHandoverAction(formData: FormData) {
  const { approvedBy } = await factoryEntryContext();
  const fromEmployeeId = text(formData, "fromEmployeeId");
  const toEmployeeId = text(formData, "toEmployeeId");
  const handover = await createProductionHandover({
    workOrderId: text(formData, "workOrderId"),
    handoverDate: text(formData, "handoverDate"),
    fromStage: option<ProductionStage>(text(formData, "fromStage"), productionStages, "Upper"),
    fromEmployee: fromEmployeeId ? await activeEmployee(fromEmployeeId) : undefined,
    toEmployee: toEmployeeId ? await activeEmployee(toEmployeeId) : undefined,
    sentPairs: integer(formData, "sentPairs"),
    receivedPairs: integer(formData, "receivedPairs"),
    receivedSizeBreakdown: sizeBreakdown(text(formData, "receivedSizeBreakdown")),
    approvedBy,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_stage_handover",
    `${handover.workOrderNumber} handed to ${handover.toStage}.`,
  );
  refresh();
}

export async function reverseHandoverAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "reverseConfirmed") !== "yes") {
    throw new Error("Confirm the stage handover reversal.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear reversal reason (at least 5 characters).");
  }
  const result = await reverseProductionHandover({
    handoverId: text(formData, "handoverId"),
    reason,
    reversedBy: approvedBy,
  });
  await recordAdminAuditEvent(
    "production_handover_reverse",
    `${result.workOrderNumber} ${result.fromStage} to ${result.toStage} handover reversed: ${reason}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${result.workOrderId}`);
  refresh();
}

export async function createWorkEntryAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  const employee = await activeEmployee(text(formData, "employeeId"));
  const result = await addApprovedWorkEntry({
    employee,
    workOrderId: text(formData, "workOrderId"),
    itemId: text(formData, "itemId"),
    stage: option<ProductionStage>(text(formData, "stage"), productionStages, "Upper"),
    workDate: text(formData, "workDate"),
    totalPairs: integer(formData, "totalPairs"),
    rejectedPairs: integer(formData, "rejectedPairs"),
    reworkPairs: integer(formData, "reworkPairs"),
    sizeBreakdown: sizeBreakdown(text(formData, "sizeBreakdown")),
    approvedBy,
    note: text(formData, "note"),
    sourceSubmissionKey: text(formData, "sourceSubmissionKey"),
  });
  await recordAdminAuditEvent(
    "production_work_approve",
    `${employee.name} work approved; earned wage Rs. ${result.earned}.`,
  );
  refresh();
}

export async function createMaterialConsumptionAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  const result = await addWorkOrderMaterialConsumption({
    workOrderId: text(formData, "workOrderId"),
    materialId: text(formData, "materialId"),
    consumptionDate: text(formData, "consumptionDate"),
    quantity: amount(formData, "quantity"),
    wastage: amount(formData, "wastage"),
    approvedBy,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "production_material_consume",
    `${result.workOrderNumber}: ${result.total} ${result.unit} ${result.materialName} consumed.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${text(formData, "workOrderId")}`);
  revalidatePath("/admin/stock");
  refresh();
}

export async function reverseMaterialConsumptionAction(formData: FormData) {
  const { approvedBy } = await ownerContext();
  if (text(formData, "reverseConfirmed") !== "yes") {
    throw new Error("Confirm the material consumption reversal.");
  }
  const reason = text(formData, "reason");
  if (reason.length < 5) {
    throw new Error("Write a clear reversal reason (at least 5 characters).");
  }
  const result = await reverseWorkOrderMaterialConsumption({
    consumptionId: text(formData, "consumptionId"),
    reason,
    reversedBy: approvedBy,
  });
  await recordAdminAuditEvent(
    "production_material_reverse",
    `${result.workOrderNumber}: ${result.total} ${result.unit} ${result.materialName} reversed; ${reason}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/work-order/${result.workOrderId}`);
  revalidatePath("/admin/stock");
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
  await recordAdminAuditEvent(
    "production_work_reverse",
    `${result.employeeName} wage Rs. ${result.earnedWage} reversed: ${reason}.`,
  );
  revalidatePath(`/admin/operations/production-accounts/worker/${result.employeeId}`);
  if (result.workOrderId) {
    revalidatePath(`/admin/operations/production-accounts/work-order/${result.workOrderId}`);
  }
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
  if (result.workOrderId) {
    revalidatePath(`/admin/operations/production-accounts/work-order/${result.workOrderId}`);
  }
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
    workOrderId: text(formData, "workOrderId"),
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
