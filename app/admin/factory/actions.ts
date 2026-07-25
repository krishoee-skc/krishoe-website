"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addFactoryProductionItem,
  addFactoryProductionEntry,
  addFactoryStageHandover,
  addFactoryWorkOrder,
  getFactoryData,
  getFactoryAssignmentSizePlan,
  releaseFactoryWorkOrder,
  verifyFactoryProductionEntry,
  upsertFactoryBomLine,
  upsertFactoryStageRate,
  upsertFactoryWorkerLink,
  factoryStages,
  isFactoryStageCode,
  type FactoryItemStatus,
  type FactoryWorkOrderPriority,
  factoryRejectReasons,
  type FactoryRejectReason,
} from "@/lib/factory";
import { getHrData } from "@/lib/hr";
import { getOperationsData } from "@/lib/operations";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return text(formData, key).split(",").map((value) => value.trim()).filter(Boolean);
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

export async function createFactoryProductionEntryAction(formData: FormData) {
  const { session } = await requireAdminPermission("factory:write");
  const assignmentId = text(formData, "assignmentId");
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
  redirect(`/admin/factory?entry=${encodeURIComponent(result.entry.id)}`);
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
