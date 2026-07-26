"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addFactoryProductionItem,
  addFactoryProductionEntry,
  addFactoryCctvReference,
  addFactoryStageHandover,
  approveFactoryPacking,
  addFactoryMaterialIssueDraft,
  finalizeFactoryMaterialIssue,
  addFactoryWorkOrder,
  approveFactoryWageSettlement,
  cancelFactoryWorkOrder,
  getFactoryData,
  getFactoryAssignmentSizePlan,
  releaseFactoryWorkOrder,
  reassignFactoryStageWorker,
  postFactoryMaterialIssue,
  postFactoryFinishedStock,
  returnFactoryMaterialIssue,
  verifyFactoryProductionEntry,
  upsertFactoryBomLine,
  upsertFactoryStageRate,
  upsertFactoryWorkerLink,
  factoryStages,
  isFactoryStageCode,
  markFactoryWageSettlementPaid,
  type FactoryItemStatus,
  type FactoryWorkOrderPriority,
  factoryRejectReasons,
  factoryCctvIncidentTypes,
  factoryWorkOrderTracePath,
  type FactoryCctvIncidentType,
  type FactoryRejectReason,
} from "@/lib/factory";
import { getHrData } from "@/lib/hr";
import { getOperationsData } from "@/lib/operations";
import { getPurchasingData } from "@/lib/purchasing";
import { buildMaterialCostRates } from "@/lib/costing";
import { syncProductCatalogStockWithFinishedStock } from "@/lib/product-store";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return text(formData, key).split(",").map((value) => value.trim()).filter(Boolean);
}

function factoryLocalDateTime(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && !/(Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? `${value}+05:45`
    : value;
}

export async function createFactoryItemAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const selectedStages = formData
    .getAll("stageCodes")
    .filter((value): value is string => typeof value === "string")
    .filter(isFactoryStageCode);
  const stageCodes = factoryStages
    .map((stage) => stage.code)
    .filter((code) => selectedStages.includes(code));

  const item = await addFactoryProductionItem({
    code: text(formData, "code"),
    nepaliName: text(formData, "nepaliName"),
    englishName: text(formData, "englishName"),
    category: text(formData, "category"),
    productId: "",
    colors: list(formData, "colors"),
    sizes: list(formData, "sizes"),
    stageCodes,
    standardMinutesPerPair: Number(text(formData, "standardMinutesPerPair")) || 0,
    status: (text(formData, "status") === "Inactive" ? "Inactive" : "Active") as FactoryItemStatus,
  });

  await recordAdminAuditEvent(
    "factory_item_create",
    `Factory production item ${item.code} · ${item.englishName} created in shadow mode.`,
  );
  revalidatePath("/admin/factory");
  redirect("/admin/factory?created=1");
}

function refreshFactory(message: string) {
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?updated=${encodeURIComponent(message)}`);
}

export async function saveFactoryBomLineAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const itemId = text(formData, "itemId");
  const materialId = text(formData, "materialId");
  const operations = await getOperationsData();
  const material = operations.rawMaterials.find((entry) => entry.id === materialId);
  if (!material) throw new Error("Selected raw material was not found.");

  await upsertFactoryBomLine({
    itemId,
    materialId,
    materialName: material.name,
    unit: material.unit,
    quantityPerPair: Number(text(formData, "quantityPerPair")) || 0,
    wastagePercent: Number(text(formData, "wastagePercent")) || 0,
  });
  await recordAdminAuditEvent(
    "factory_bom_upsert",
    `BOM material ${material.name} saved for factory item ${itemId}.`,
  );
  refreshFactory("BOM material saved.");
}

export async function saveFactoryStageRateAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const stageCode = text(formData, "stageCode");
  if (!isFactoryStageCode(stageCode)) throw new Error("Valid factory stage is required.");

  await upsertFactoryStageRate({
    itemId: text(formData, "itemId"),
    stageCode,
    ratePerGoodPair: Number(text(formData, "ratePerGoodPair")) || 0,
  });
  await recordAdminAuditEvent(
    "factory_stage_rate_upsert",
    `Stage rate saved for ${stageCode} in shadow mode.`,
  );
  refreshFactory("Stage wage rate saved.");
}

export async function saveFactoryWorkerLinkAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const employeeId = text(formData, "employeeId");
  const hr = await getHrData();
  const employee = hr.employees.find((entry) => entry.id === employeeId);
  if (!employee) throw new Error("Selected HR employee was not found.");
  const selectedStages = formData
    .getAll("workerStageCodes")
    .filter((value): value is string => typeof value === "string")
    .filter(isFactoryStageCode);
  const stageCodes = factoryStages
    .map((stage) => stage.code)
    .filter((code) => selectedStages.includes(code));

  await upsertFactoryWorkerLink({ employeeId, stageCodes, active: true });
  await recordAdminAuditEvent(
    "factory_worker_link_upsert",
    `HR employee ${employee.name} linked to ${stageCodes.length} factory stages.`,
  );
  refreshFactory("Factory worker linkage saved.");
}

export async function createFactoryWorkOrderAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const itemId = text(formData, "itemId");
  const factory = await getFactoryData();
  const item = factory.items.find((entry) => entry.id === itemId && entry.status === "Active");
  if (!item) throw new Error("Selected active production item was not found.");
  const color = text(formData, "color");
  if (!item.colors.includes(color)) throw new Error("Select a colour configured for this item.");
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = text(formData, "dueDate");
  if (!dueDate || dueDate < today) throw new Error("Due date cannot be before today.");
  const priorityValue = text(formData, "priority");
  const priority: FactoryWorkOrderPriority =
    priorityValue === "High" || priorityValue === "Urgent" ? priorityValue : "Normal";

  const result = await addFactoryWorkOrder({
    item,
    color,
    createdDate: today,
    dueDate,
    priority,
    remarks: text(formData, "remarks"),
    createdBy: session.name || session.email || "Admin",
    sizes: item.sizes.map((size) => ({
      size,
      plannedPairs: Number(text(formData, `size__${size}`)) || 0,
    })),
  });
  await recordAdminAuditEvent(
    "factory_work_order_create",
    `${result.workOrder.workOrderNumber} created for ${item.code}, ${result.workOrder.totalPairs} pairs in shadow mode.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?workOrder=${encodeURIComponent(result.workOrder.workOrderNumber)}`);
}

export async function releaseFactoryWorkOrderAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const workOrderId = text(formData, "workOrderId");
  const [factory, hr] = await Promise.all([getFactoryData(), getHrData()]);
  const workOrder = factory.workOrders.find((entry) => entry.id === workOrderId);
  if (!workOrder) throw new Error("Work Order was not found.");
  const item = factory.items.find((entry) => entry.id === workOrder.itemId);
  if (!item) throw new Error("Production item was not found.");

  const assignments = item.stageCodes.map((stageCode) => {
    const workerId = text(formData, `worker__${stageCode}`);
    const employee = hr.employees.find(
      (entry) => entry.id === workerId && entry.status === "Active",
    );
    const workerLink = factory.workerLinks.find(
      (entry) =>
        entry.employeeId === workerId &&
        entry.active &&
        entry.stageCodes.includes(stageCode),
    );
    if (!employee || !workerLink) {
      throw new Error(`Select an eligible active worker for ${stageCode}.`);
    }
    const rate = factory.stageRates.find(
      (entry) => entry.itemId === item.id && entry.stageCode === stageCode,
    );
    if (!rate) throw new Error(`Configure the wage rate for ${stageCode} before release.`);
    return {
      stageCode,
      workerId,
      workerName: employee.name,
      ratePerGoodPairSnapshot: rate.ratePerGoodPair,
      cameraZone: text(formData, `camera__${stageCode}`),
    };
  });

  await releaseFactoryWorkOrder({
    workOrder,
    item,
    bomLines: factory.bomLines.filter((entry) => entry.itemId === item.id),
    assignments,
  });
  await recordAdminAuditEvent(
    "factory_work_order_release",
    `${workOrder.workOrderNumber} released with ${assignments.length} stage assignments.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?released=${encodeURIComponent(workOrder.workOrderNumber)}`);
}

export async function cancelFactoryWorkOrderAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === text(formData, "workOrderId"),
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const reason = text(formData, "reason");
  const cancelledBy = session.name || session.email || "Admin";
  await cancelFactoryWorkOrder({
    workOrder,
    data: factory,
    reason,
    cancelledBy,
  });
  await recordAdminAuditEvent(
    "factory_work_order_cancel",
    `${workOrder.workOrderNumber} cancelled by ${cancelledBy}. Reason: ${reason}`,
  );
  revalidatePath("/admin/factory");
  revalidatePath(factoryWorkOrderTracePath(workOrder.id));
  redirect(`/admin/factory?cancelled=${encodeURIComponent(workOrder.workOrderNumber)}`);
}

export async function createFactoryProductionEntryAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const assignmentId = text(formData, "assignmentId");
  const offlineDraftId = text(formData, "offlineDraftId");
  const factory = await getFactoryData();
  const assignment = factory.stageAssignments.find((entry) => entry.id === assignmentId);
  if (!assignment) throw new Error("Stage assignment was not found.");
  const workOrder = factory.workOrders.find((entry) => entry.id === assignment.workOrderId);
  if (!workOrder) throw new Error("Work Order was not found.");
  const plannedSizes = getFactoryAssignmentSizePlan(factory, assignment);
  if (plannedSizes.length === 0) {
    throw new Error("This stage has not received any size quantity yet.");
  }

  const result = await addFactoryProductionEntry({
    workOrder,
    assignment,
    plannedSizes,
    existingEntries: factory.productionEntries,
    existingEntrySizes: factory.productionEntrySizes,
    sizes: plannedSizes.map((row) => ({
      size: row.size,
      goodPairs: Number(text(formData, `good__${row.size}`)) || 0,
      rejectPairs: Number(text(formData, `reject__${row.size}`)) || 0,
      reworkPairs: Number(text(formData, `rework__${row.size}`)) || 0,
    })),
    remarks: text(formData, "remarks"),
    enteredBy: session.name || session.email || "Admin",
  });
  await recordAdminAuditEvent(
    "factory_production_entry_submit",
    `${workOrder.workOrderNumber} ${assignment.stageCode}: ${result.entry.goodPairs} good, ${result.entry.rejectPairs} reject, ${result.entry.reworkPairs} rework submitted.`,
  );
  revalidatePath("/admin/factory");
  const query = new URLSearchParams({ entry: result.entry.id });
  if (offlineDraftId) query.set("offlineSynced", offlineDraftId);
  redirect(`/admin/factory?${query.toString()}`);
}

export async function reassignFactoryStageWorkerAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const hr = await getHrData();
  const assignment = factory.stageAssignments.find(
    (entry) => entry.id === text(formData, "assignmentId"),
  );
  if (!assignment) throw new Error("Stage assignment was not found.");
  const employee = hr.employees.find(
    (entry) =>
      entry.id === text(formData, "workerId") && entry.status === "Active",
  );
  if (!employee) throw new Error("Select an active HR employee.");
  const workerLink = factory.workerLinks.find(
    (entry) =>
      entry.employeeId === employee.id &&
      entry.active &&
      entry.stageCodes.includes(assignment.stageCode),
  );
  if (!workerLink) {
    throw new Error("This worker is not enabled for the selected factory stage.");
  }
  const previousWorker = assignment.workerName;
  const updated = await reassignFactoryStageWorker({
    assignment,
    workerId: employee.id,
    workerName: employee.name,
    ratePerGoodPair: Number(text(formData, "ratePerGoodPair")),
    cameraZone: text(formData, "cameraZone"),
  });
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === assignment.workOrderId,
  );
  await recordAdminAuditEvent(
    "factory_stage_worker_reassign",
    `${workOrder?.workOrderNumber ?? assignment.workOrderId} ${assignment.stageCode}: ${previousWorker} changed to ${updated.workerName} by ${session.name || session.email || "Admin"}; future rate Rs. ${updated.ratePerGoodPairSnapshot}/pair.`,
  );
  revalidatePath("/admin/factory");
  revalidatePath(factoryWorkOrderTracePath(assignment.workOrderId));
  redirect(`/admin/factory?reassigned=${encodeURIComponent(assignment.id)}`);
}

export async function verifyFactoryProductionEntryAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const entry = factory.productionEntries.find((row) => row.id === text(formData, "entryId"));
  if (!entry) throw new Error("Production entry was not found.");
  const decision = text(formData, "decision") === "Rejected" ? "Rejected" : "Verified";
  const reasonValue = text(formData, "rejectReason");
  const rejectReason: FactoryRejectReason | "" = factoryRejectReasons.includes(
    reasonValue as FactoryRejectReason,
  )
    ? (reasonValue as FactoryRejectReason)
    : "";

  await verifyFactoryProductionEntry({
    entry,
    decision,
    rejectReason,
    responsibleWorkerId: text(formData, "responsibleWorkerId"),
    reworkPossible: formData.get("reworkPossible") === "on",
    verificationNote: text(formData, "verificationNote"),
    verifiedBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_production_entry_verify",
    `${entry.id} marked ${decision}; ${entry.goodPairs} good pairs, wage Rs. ${entry.calculatedWage}.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?verified=${encodeURIComponent(entry.id)}`);
}

export async function createFactoryStageHandoverAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const fromAssignment = factory.stageAssignments.find(
    (entry) => entry.id === text(formData, "fromAssignmentId"),
  );
  if (!fromAssignment) throw new Error("Source stage assignment was not found.");
  const toAssignment = factory.stageAssignments.find(
    (entry) =>
      entry.workOrderId === fromAssignment.workOrderId &&
      entry.sequence === fromAssignment.sequence + 1,
  );
  if (!toAssignment) throw new Error("The next stage assignment was not found.");
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === fromAssignment.workOrderId,
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const plannedSizes = factory.workOrderSizes.filter(
    (entry) => entry.workOrderId === workOrder.id,
  );

  const result = await addFactoryStageHandover({
    workOrder,
    fromAssignment,
    toAssignment,
    verifiedEntries: factory.productionEntries,
    productionEntrySizes: factory.productionEntrySizes,
    previousHandovers: factory.stageHandovers,
    previousHandoverSizes: factory.stageHandoverSizes,
    sizes: plannedSizes.map((row) => ({
      size: row.size,
      sentPairs: Number(text(formData, `sent__${row.size}`)) || 0,
      receivedPairs: Number(text(formData, `received__${row.size}`)) || 0,
    })),
    remarks: text(formData, "remarks"),
    handedOverBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_stage_handover_create",
    `${workOrder.workOrderNumber}: ${fromAssignment.stageCode} → ${toAssignment.stageCode}, sent ${result.handover.sentPairs}, received ${result.handover.receivedPairs}, difference ${result.handover.discrepancyPairs}.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?handover=${encodeURIComponent(result.handover.id)}`);
}

export async function approveFactoryPackingAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === text(formData, "workOrderId"),
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const approval = await approveFactoryPacking({
    data: factory,
    workOrder,
    approvedBy: session.name || session.email || "Owner",
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "factory_packing_approve",
    `${workOrder.workOrderNumber}: ${approval.approvedPairs} packed pairs marked Ready for Stock. No stock was posted.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?packed=${encodeURIComponent(workOrder.workOrderNumber)}`);
}

export async function createFactoryMaterialIssueDraftAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const [factory, operations, purchasing] = await Promise.all([
    getFactoryData(),
    getOperationsData(),
    getPurchasingData(),
  ]);
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === text(formData, "workOrderId"),
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const bomLine = factory.bomLines.find(
    (entry) =>
      entry.id === text(formData, "bomLineId") &&
      entry.itemId === workOrder.itemId,
  );
  if (!bomLine) throw new Error("Selected BOM material was not found.");
  const material = operations.rawMaterials.find(
    (entry) => entry.id === bomLine.materialId,
  );
  if (!material) throw new Error("Raw material inventory record was not found.");
  const rates = buildMaterialCostRates(purchasing.purchaseInvoices);
  const rate =
    rates.find((entry) => entry.materialId === material.id)?.averageUnitCost ?? 0;
  const availableStock = Math.max(
    0,
    material.openingStock + material.received - material.used,
  );

  const issue = await addFactoryMaterialIssueDraft({
    workOrder,
    bomLine,
    existingIssues: factory.materialIssues,
    quantity: Number(text(formData, "quantity")) || 0,
    availableStock,
    unitCostSnapshot: rate,
    note: text(formData, "note"),
    createdBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_material_issue_draft",
    `${workOrder.workOrderNumber}: draft ${issue.quantity} ${issue.unit} ${issue.materialName}, cost Rs. ${issue.totalCost}. Raw stock unchanged.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?materialDraft=${encodeURIComponent(issue.id)}`);
}

export async function postFactoryMaterialIssueAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const issue = factory.materialIssues.find(
    (entry) => entry.id === text(formData, "issueId"),
  );
  if (!issue) throw new Error("Material issue was not found.");
  const posted = await postFactoryMaterialIssue({
    issue,
    postedBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_material_issue_post",
    `${posted.materialName}: ${posted.quantity} ${posted.unit} posted to production and deducted from raw stock.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?materialPosted=${encodeURIComponent(posted.id)}`);
}

export async function returnFactoryMaterialIssueAction(formData: FormData) {
  await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const issue = factory.materialIssues.find(
    (entry) => entry.id === text(formData, "issueId"),
  );
  if (!issue) throw new Error("Material issue was not found.");
  const returned = await returnFactoryMaterialIssue({
    issue,
    quantity: Number(text(formData, "quantity")) || 0,
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "factory_material_issue_return",
    `${returned.materialName}: ${text(formData, "quantity")} ${returned.unit} returned to raw stock.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?materialReturned=${encodeURIComponent(returned.id)}`);
}

export async function finalizeFactoryMaterialIssueAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const issue = factory.materialIssues.find(
    (entry) => entry.id === text(formData, "issueId"),
  );
  if (!issue) throw new Error("Material issue was not found.");
  const finalized = await finalizeFactoryMaterialIssue({
    issue,
    consumedQuantity: Number(text(formData, "consumedQuantity")) || 0,
    wastageQuantity: Number(text(formData, "wastageQuantity")) || 0,
    note: text(formData, "note"),
    finalizedBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_material_issue_finalize",
    `${finalized.materialName}: ${finalized.consumedQuantity} ${finalized.unit} consumed, ${finalized.wastageQuantity} ${finalized.unit} wastage finalized.`,
  );
  revalidatePath("/admin/factory");
  redirect(`/admin/factory?materialFinalized=${encodeURIComponent(finalized.id)}`);
}

export async function postFactoryFinishedStockAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === text(formData, "workOrderId"),
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const result = await postFactoryFinishedStock({
    data: factory,
    workOrder,
    postedBy: session.name || session.email || "Owner",
  });
  await syncProductCatalogStockWithFinishedStock();
  await recordAdminAuditEvent(
    "factory_finished_stock_post",
    `${workOrder.workOrderNumber}: ${result.postedPairs} ${workOrder.itemName} pairs posted size-wise to finished stock and catalog synchronized.`,
  );
  revalidatePath("/admin/factory");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/operations");
  revalidatePath("/shop");
  redirect(`/admin/factory?stockPosted=${encodeURIComponent(workOrder.workOrderNumber)}`);
}

export async function approveFactoryWageSettlementAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const settlement = await approveFactoryWageSettlement({
    data: factory,
    workerId: text(formData, "workerId"),
    fromDate: text(formData, "fromDate"),
    toDate: text(formData, "toDate"),
    approvedBy: session.name || session.email || "Owner",
    note: text(formData, "note"),
  });
  await recordAdminAuditEvent(
    "factory_wage_settlement_approve",
    `${settlement.workerName}: Rs. ${settlement.amount} approved for ${settlement.goodPairs} verified good pairs (${settlement.fromDate} to ${settlement.toDate}).`,
  );
  revalidatePath("/admin/factory");
  revalidatePath("/admin/factory/reports");
  redirect(
    `/admin/factory/reports?period=custom&from=${settlement.fromDate}&to=${settlement.toDate}&wageApproved=${encodeURIComponent(settlement.id)}`,
  );
}

export async function markFactoryWageSettlementPaidAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const settlement = factory.wageSettlements.find(
    (entry) => entry.id === text(formData, "settlementId"),
  );
  if (!settlement) throw new Error("Wage settlement was not found.");
  const paid = await markFactoryWageSettlementPaid({
    settlement,
    paidBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_wage_settlement_paid",
    `${paid.workerName}: Factory piece wage Rs. ${paid.amount} marked Paid.`,
  );
  revalidatePath("/admin/factory");
  revalidatePath("/admin/factory/reports");
  redirect(`/admin/factory/reports?wagePaid=${encodeURIComponent(paid.id)}`);
}

export async function addFactoryCctvReferenceAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const factory = await getFactoryData();
  const workOrder = factory.workOrders.find(
    (entry) => entry.id === text(formData, "workOrderId"),
  );
  if (!workOrder) throw new Error("Work Order was not found.");
  const stageCode = text(formData, "stageCode");
  if (!isFactoryStageCode(stageCode)) throw new Error("Factory stage is invalid.");
  const incidentValue = text(formData, "incidentType");
  const incidentType = factoryCctvIncidentTypes.includes(
    incidentValue as FactoryCctvIncidentType,
  )
    ? (incidentValue as FactoryCctvIncidentType)
    : "Routine verification";
  const reference = await addFactoryCctvReference({
    workOrder,
    stageCode,
    cameraZone: text(formData, "cameraZone"),
    startedAt: factoryLocalDateTime(formData, "startedAt"),
    endedAt: factoryLocalDateTime(formData, "endedAt"),
    referenceUrl: text(formData, "referenceUrl"),
    incidentType,
    note: text(formData, "note"),
    createdBy: session.name || session.email || "Owner",
  });
  await recordAdminAuditEvent(
    "factory_cctv_reference",
    `${workOrder.workOrderNumber}: ${reference.incidentType} CCTV reference saved for ${reference.cameraZone}, ${reference.startedAt} to ${reference.endedAt}.`,
  );
  const tracePath = factoryWorkOrderTracePath(workOrder.id);
  revalidatePath(tracePath);
  redirect(`${tracePath}?cctvSaved=${encodeURIComponent(reference.id)}`);
}
