import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "@/lib/atomic-json";
import { runWithDataBackend } from "@/lib/data-backend";
import type { Employee } from "@/lib/hr";
import type { ProductionBatch, WorkerTask } from "@/lib/operations";
import { insertStockMovement } from "@/lib/operations-postgres";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

export type FactoryItemStatus = "Active" | "Inactive";
export type FactoryMaterialUnit = "kg" | "meter" | "pair" | "piece" | "liter";

export type FactoryProductionItem = {
  id: string;
  code: string;
  nepaliName: string;
  englishName: string;
  category: string;
  productId: string;
  colors: string[];
  sizes: string[];
  stageCodes: FactoryStageCode[];
  standardMinutesPerPair: number;
  status: FactoryItemStatus;
};

export type FactoryBomLine = {
  id: string;
  itemId: string;
  materialId: string;
  materialName: string;
  unit: FactoryMaterialUnit;
  quantityPerPair: number;
  wastagePercent: number;
};

export type FactoryStageRate = {
  id: string;
  itemId: string;
  stageCode: FactoryStageCode;
  ratePerGoodPair: number;
};

export type FactoryWorkerLink = {
  employeeId: string;
  stageCodes: FactoryStageCode[];
  active: boolean;
};

export type FactoryData = {
  items: FactoryProductionItem[];
  bomLines: FactoryBomLine[];
  stageRates: FactoryStageRate[];
  workerLinks: FactoryWorkerLink[];
  workOrders: FactoryWorkOrder[];
  workOrderSizes: FactoryWorkOrderSize[];
  stageAssignments: FactoryStageAssignment[];
  productionEntries: FactoryProductionEntry[];
  productionEntrySizes: FactoryProductionEntrySize[];
  stageHandovers: FactoryStageHandover[];
  stageHandoverSizes: FactoryStageHandoverSize[];
  packingApprovals: FactoryPackingApproval[];
  materialIssues: FactoryMaterialIssue[];
};

export type FactoryMaterialIssueStatus = "Draft" | "Posted" | "Cancelled";

export type FactoryMaterialIssue = {
  id: string;
  workOrderId: string;
  materialId: string;
  materialName: string;
  unit: FactoryMaterialUnit;
  quantity: number;
  unitCostSnapshot: number;
  totalCost: number;
  status: FactoryMaterialIssueStatus;
  postedBy: string;
  postedAt: string;
  returnedQuantity: number;
  consumedQuantity: number;
  wastageQuantity: number;
  finalizedBy: string;
  finalizedAt: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type FactoryStageHandover = {
  id: string;
  workOrderId: string;
  fromAssignmentId: string;
  toAssignmentId: string;
  fromStageCode: FactoryStageCode;
  toStageCode: FactoryStageCode;
  fromWorkerId: string;
  fromWorkerName: string;
  toWorkerId: string;
  toWorkerName: string;
  sentPairs: number;
  receivedPairs: number;
  discrepancyPairs: number;
  remarks: string;
  handedOverBy: string;
  createdAt: string;
};

export type FactoryStageHandoverSize = {
  id: string;
  handoverId: string;
  size: string;
  sentPairs: number;
  receivedPairs: number;
  discrepancyPairs: number;
};

export type FactoryPackingApproval = {
  id: string;
  workOrderId: string;
  packingAssignmentId: string;
  approvedPairs: number;
  approvedBy: string;
  stockMovementIds: string[];
  stockPostedBy: string;
  stockPostedAt: string;
  note: string;
  createdAt: string;
};

export type FactoryProductionEntryStatus = "Submitted" | "Verified" | "Rejected";
export const factoryRejectReasons = [
  "Cutting defect",
  "Stitching defect",
  "Sole bonding",
  "Size mismatch",
  "Colour mismatch",
  "Finishing defect",
  "Packing defect",
  "Material defect",
  "Other",
] as const;
export type FactoryRejectReason = (typeof factoryRejectReasons)[number];

export type FactoryProductionEntry = {
  id: string;
  workOrderId: string;
  assignmentId: string;
  workerId: string;
  workerName: string;
  stageCode: FactoryStageCode;
  entryDate: string;
  receivedPairs: number;
  goodPairs: number;
  rejectPairs: number;
  reworkPairs: number;
  wageRateSnapshot: number;
  calculatedWage: number;
  status: FactoryProductionEntryStatus;
  remarks: string;
  enteredBy: string;
  createdAt: string;
  rejectReason: FactoryRejectReason | "";
  responsibleWorkerId: string;
  reworkPossible: boolean;
  verificationNote: string;
  verifiedBy: string;
  verifiedAt: string;
};

export type FactoryProductionEntrySize = {
  id: string;
  productionEntryId: string;
  size: string;
  receivedPairs: number;
  goodPairs: number;
  rejectPairs: number;
  reworkPairs: number;
};

export type FactoryStageAssignmentStatus =
  | "Waiting"
  | "Ready"
  | "In Progress"
  | "Paused"
  | "Completed";

export type FactoryStageAssignment = {
  id: string;
  workOrderId: string;
  stageCode: FactoryStageCode;
  sequence: number;
  workerId: string;
  workerName: string;
  targetPairs: number;
  status: FactoryStageAssignmentStatus;
  ratePerGoodPairSnapshot: number;
  cameraZone: string;
};

export type FactoryWorkOrderStatus =
  | "Draft"
  | "Released"
  | "In Progress"
  | "Ready for Stock"
  | "Completed"
  | "Cancelled";
export type FactoryWorkOrderPriority = "Normal" | "High" | "Urgent";

export type FactoryWorkOrder = {
  id: string;
  workOrderNumber: string;
  lotNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  color: string;
  createdDate: string;
  dueDate: string;
  priority: FactoryWorkOrderPriority;
  currentStageCode: FactoryStageCode | "";
  status: FactoryWorkOrderStatus;
  totalPairs: number;
  remarks: string;
  createdBy: string;
};

export type FactoryWorkOrderSize = {
  id: string;
  workOrderId: string;
  size: string;
  plannedPairs: number;
};

export const factoryStages = [
  { code: "upper", name: "Upper", description: "Upper preparation and completion" },
  {
    code: "bottom-preparation",
    name: "Bottom Preparation",
    description: "Bottom man receives the upper and completes the first half",
  },
  {
    code: "fiber-stitching",
    name: "Fiber Silai",
    description: "A separate fiber-stitching worker completes the stitch work",
  },
  {
    code: "bottom-lasting",
    name: "Bottom Lasting / Assembly",
    description: "The bottom man receives the stitched fiber and completes the product",
  },
  {
    code: "finishing",
    name: "Finishing",
    description: "Final finishing and preparation for packing",
  },
  {
    code: "packing",
    name: "Packing",
    description: "Size and colour verification before finished-stock posting",
  },
] as const;

export type FactoryStageCode = (typeof factoryStages)[number]["code"];

const factoryStageCodeSet = new Set<string>(factoryStages.map((stage) => stage.code));

export function isFactoryStageCode(value: string): value is FactoryStageCode {
  return factoryStageCodeSet.has(value);
}

export function normalizeFactoryItem(input: FactoryProductionItem): FactoryProductionItem {
  const unique = (values: string[]) =>
    [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const stageCodes = unique(input.stageCodes).filter(isFactoryStageCode);

  if (!input.code.trim() || !input.englishName.trim()) {
    throw new Error("Production item code and English name are required.");
  }
  if (stageCodes.length === 0) {
    throw new Error("A production item needs at least one factory stage.");
  }

  return {
    ...input,
    code: input.code.trim().toUpperCase(),
    nepaliName: input.nepaliName.trim(),
    englishName: input.englishName.trim(),
    category: input.category.trim(),
    productId: input.productId.trim(),
    colors: unique(input.colors),
    sizes: unique(input.sizes),
    stageCodes,
    standardMinutesPerPair: Math.max(0, Math.round(input.standardMinutesPerPair * 100) / 100),
  };
}

export function calculateBomRequirement(line: FactoryBomLine, plannedPairs: number) {
  const pairs = Math.max(0, Math.round(plannedPairs));
  const baseQuantity = Math.max(0, line.quantityPerPair) * pairs;
  const wastageQuantity = baseQuantity * (Math.max(0, line.wastagePercent) / 100);

  return {
    baseQuantity: Math.round(baseQuantity * 10000) / 10000,
    wastageQuantity: Math.round(wastageQuantity * 10000) / 10000,
    requiredQuantity: Math.round((baseQuantity + wastageQuantity) * 10000) / 10000,
  };
}

const factoryDataPath = path.join(process.cwd(), "data", "factory.json");
const emptyFactoryData: FactoryData = {
  items: [],
  bomLines: [],
  stageRates: [],
  workerLinks: [],
  workOrders: [],
  workOrderSizes: [],
  stageAssignments: [],
  productionEntries: [],
  productionEntrySizes: [],
  stageHandovers: [],
  stageHandoverSizes: [],
  packingApprovals: [],
  materialIssues: [],
};

function createFactoryId(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function factoryDateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

async function readLocalFactoryData(): Promise<FactoryData> {
  try {
    const parsed = JSON.parse(await readFile(factoryDataPath, "utf8")) as Partial<FactoryData>;
    return {
      items: parsed.items ?? [],
      bomLines: parsed.bomLines ?? [],
      stageRates: parsed.stageRates ?? [],
      workerLinks: parsed.workerLinks ?? [],
      workOrders: parsed.workOrders ?? [],
      workOrderSizes: parsed.workOrderSizes ?? [],
      stageAssignments: parsed.stageAssignments ?? [],
      productionEntries: parsed.productionEntries ?? [],
      productionEntrySizes: parsed.productionEntrySizes ?? [],
      stageHandovers: parsed.stageHandovers ?? [],
      stageHandoverSizes: parsed.stageHandoverSizes ?? [],
      packingApprovals: parsed.packingApprovals ?? [],
      materialIssues: parsed.materialIssues ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(emptyFactoryData);
    throw error;
  }
}

type FactoryItemRow = {
  id: string;
  code: string;
  nepali_name: string;
  english_name: string;
  category: string;
  product_id: string | null;
  colors: string[];
  sizes: string[];
  stage_codes: string[];
  standard_minutes_per_pair: number | string;
  status: FactoryItemStatus;
};

type FactoryBomRow = {
  id: string;
  item_id: string;
  material_id: string;
  material_name: string;
  unit: FactoryMaterialUnit;
  quantity_per_pair: number | string;
  wastage_percent: number | string;
};

type FactoryStageRateRow = {
  id: string;
  item_id: string;
  stage_code: string;
  rate_per_good_pair: number | string;
};

type FactoryWorkerLinkRow = {
  employee_id: string;
  stage_codes: string[];
  active: boolean;
};

type FactoryWorkOrderRow = {
  id: string;
  work_order_number: string;
  lot_number: string;
  item_id: string;
  item_code: string;
  item_name: string;
  color: string;
  created_date: Date | string;
  due_date: Date | string;
  priority: FactoryWorkOrderPriority;
  current_stage_code: string;
  status: FactoryWorkOrderStatus;
  total_pairs: number | string;
  remarks: string;
  created_by: string;
};

type FactoryWorkOrderSizeRow = {
  id: string;
  work_order_id: string;
  size: string;
  planned_pairs: number | string;
};

type FactoryStageAssignmentRow = {
  id: string;
  work_order_id: string;
  stage_code: string;
  sequence: number | string;
  worker_id: string;
  worker_name: string;
  target_pairs: number | string;
  status: FactoryStageAssignmentStatus;
  rate_per_good_pair_snapshot: number | string;
  camera_zone: string;
};

type FactoryProductionEntryRow = {
  id: string;
  work_order_id: string;
  assignment_id: string;
  worker_id: string;
  worker_name: string;
  stage_code: string;
  entry_date: Date | string;
  received_pairs: number | string;
  good_pairs: number | string;
  reject_pairs: number | string;
  rework_pairs: number | string;
  wage_rate_snapshot: number | string;
  calculated_wage: number | string;
  status: FactoryProductionEntryStatus;
  remarks: string;
  entered_by: string;
  created_at: Date | string;
  reject_reason: string;
  responsible_worker_id: string | null;
  rework_possible: boolean;
  verification_note: string;
  verified_by: string;
  verified_at: Date | string | null;
};

type FactoryProductionEntrySizeRow = {
  id: string;
  production_entry_id: string;
  size: string;
  received_pairs: number | string;
  good_pairs: number | string;
  reject_pairs: number | string;
  rework_pairs: number | string;
};

type FactoryStageHandoverRow = {
  id: string;
  work_order_id: string;
  from_assignment_id: string;
  to_assignment_id: string;
  from_stage_code: string;
  to_stage_code: string;
  from_worker_id: string;
  from_worker_name: string;
  to_worker_id: string;
  to_worker_name: string;
  sent_pairs: number | string;
  received_pairs: number | string;
  discrepancy_pairs: number | string;
  remarks: string;
  handed_over_by: string;
  created_at: Date | string;
};

type FactoryStageHandoverSizeRow = {
  id: string;
  handover_id: string;
  size: string;
  sent_pairs: number | string;
  received_pairs: number | string;
  discrepancy_pairs: number | string;
};

type FactoryPackingApprovalRow = {
  id: string;
  work_order_id: string;
  packing_assignment_id: string;
  approved_pairs: number | string;
  approved_by: string;
  stock_movement_ids: string[];
  stock_posted_by: string;
  stock_posted_at: Date | string | null;
  note: string;
  created_at: Date | string;
};

type FactoryMaterialIssueRow = {
  id: string;
  work_order_id: string;
  material_id: string;
  material_name: string;
  unit: FactoryMaterialUnit;
  quantity: number | string;
  unit_cost_snapshot: number | string;
  total_cost: number | string;
  status: FactoryMaterialIssueStatus;
  posted_by: string;
  posted_at: Date | string | null;
  returned_quantity: number | string;
  consumed_quantity: number | string;
  wastage_quantity: number | string;
  finalized_by: string;
  finalized_at: Date | string | null;
  note: string;
  created_by: string;
  created_at: Date | string;
};

async function getFactoryDataFromPostgres(): Promise<FactoryData> {
  const [
    items,
    bomLines,
    stageRates,
    workerLinks,
    workOrders,
    workOrderSizes,
    stageAssignments,
    productionEntries,
    productionEntrySizes,
    stageHandovers,
    stageHandoverSizes,
    packingApprovals,
    materialIssues,
  ] = await Promise.all([
    queryPostgres<FactoryItemRow>(
      "factory",
      `SELECT id, code, nepali_name, english_name, category, product_id, colors, sizes,
        stage_codes, standard_minutes_per_pair, status
       FROM factory_production_items ORDER BY english_name ASC`,
    ),
    queryPostgres<FactoryBomRow>(
      "factory",
      `SELECT id, item_id, material_id, material_name, unit, quantity_per_pair,
        wastage_percent FROM factory_item_bom ORDER BY material_name ASC`,
    ),
    queryPostgres<FactoryStageRateRow>(
      "factory",
      `SELECT id, item_id, stage_code, rate_per_good_pair
       FROM factory_item_stage_rates ORDER BY stage_code ASC`,
    ),
    queryPostgres<FactoryWorkerLinkRow>(
      "factory",
      "SELECT employee_id, stage_codes, active FROM factory_worker_links ORDER BY employee_id ASC",
    ),
    queryPostgres<FactoryWorkOrderRow>(
      "factory",
      `SELECT id, work_order_number, lot_number, item_id, item_code, item_name,
        color, created_date, due_date, priority, current_stage_code, status,
        total_pairs, remarks, created_by
       FROM factory_work_orders ORDER BY created_at DESC`,
    ),
    queryPostgres<FactoryWorkOrderSizeRow>(
      "factory",
      `SELECT id, work_order_id, size, planned_pairs
       FROM factory_work_order_sizes ORDER BY size ASC`,
    ),
    queryPostgres<FactoryStageAssignmentRow>(
      "factory",
      `SELECT id, work_order_id, stage_code, sequence, worker_id, worker_name,
        target_pairs, status, rate_per_good_pair_snapshot, camera_zone
       FROM factory_stage_assignments ORDER BY work_order_id, sequence ASC`,
    ),
    queryPostgres<FactoryProductionEntryRow>(
      "factory",
      `SELECT id, work_order_id, assignment_id, worker_id, worker_name, stage_code,
        entry_date, received_pairs, good_pairs, reject_pairs, rework_pairs,
        wage_rate_snapshot, calculated_wage, status, remarks, entered_by, created_at,
        reject_reason, responsible_worker_id, rework_possible, verification_note,
        verified_by, verified_at
       FROM factory_production_entries ORDER BY created_at DESC`,
    ),
    queryPostgres<FactoryProductionEntrySizeRow>(
      "factory",
      `SELECT id, production_entry_id, size, received_pairs, good_pairs,
        reject_pairs, rework_pairs
       FROM factory_production_entry_sizes ORDER BY size ASC`,
    ),
    queryPostgres<FactoryStageHandoverRow>(
      "factory",
      `SELECT id, work_order_id, from_assignment_id, to_assignment_id,
        from_stage_code, to_stage_code, from_worker_id, from_worker_name,
        to_worker_id, to_worker_name, sent_pairs, received_pairs,
        discrepancy_pairs, remarks, handed_over_by, created_at
       FROM factory_stage_handovers ORDER BY created_at DESC`,
    ),
    queryPostgres<FactoryStageHandoverSizeRow>(
      "factory",
      `SELECT id, handover_id, size, sent_pairs, received_pairs, discrepancy_pairs
       FROM factory_stage_handover_sizes ORDER BY size ASC`,
    ),
    queryPostgres<FactoryPackingApprovalRow>(
      "factory",
      `SELECT id, work_order_id, packing_assignment_id, approved_pairs,
        approved_by, stock_movement_ids, stock_posted_by, stock_posted_at,
        note, created_at
       FROM factory_packing_approvals ORDER BY created_at DESC`,
    ),
    queryPostgres<FactoryMaterialIssueRow>(
      "factory",
      `SELECT id, work_order_id, material_id, material_name, unit, quantity,
        unit_cost_snapshot, total_cost, status, posted_by, posted_at, returned_quantity,
        consumed_quantity, wastage_quantity, finalized_by, finalized_at,
        note, created_by, created_at
       FROM factory_material_issues ORDER BY created_at DESC`,
    ),
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      code: row.code,
      nepaliName: row.nepali_name,
      englishName: row.english_name,
      category: row.category,
      productId: row.product_id ?? "",
      colors: row.colors ?? [],
      sizes: row.sizes ?? [],
      stageCodes: (row.stage_codes ?? []).filter(isFactoryStageCode),
      standardMinutesPerPair: Number(row.standard_minutes_per_pair),
      status: row.status,
    })),
    bomLines: bomLines.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      materialId: row.material_id,
      materialName: row.material_name,
      unit: row.unit,
      quantityPerPair: Number(row.quantity_per_pair),
      wastagePercent: Number(row.wastage_percent),
    })),
    stageRates: stageRates
      .filter((row) => isFactoryStageCode(row.stage_code))
      .map((row) => ({
        id: row.id,
        itemId: row.item_id,
        stageCode: row.stage_code as FactoryStageCode,
        ratePerGoodPair: Number(row.rate_per_good_pair),
      })),
    workerLinks: workerLinks.map((row) => ({
      employeeId: row.employee_id,
      stageCodes: (row.stage_codes ?? []).filter(isFactoryStageCode),
      active: row.active,
    })),
    workOrders: workOrders.map((row) => ({
      id: row.id,
      workOrderNumber: row.work_order_number,
      lotNumber: row.lot_number,
      itemId: row.item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      color: row.color,
      createdDate: factoryDateOnly(row.created_date),
      dueDate: factoryDateOnly(row.due_date),
      priority: row.priority,
      currentStageCode: isFactoryStageCode(row.current_stage_code)
        ? row.current_stage_code
        : "",
      status: row.status,
      totalPairs: Number(row.total_pairs),
      remarks: row.remarks,
      createdBy: row.created_by,
    })),
    workOrderSizes: workOrderSizes.map((row) => ({
      id: row.id,
      workOrderId: row.work_order_id,
      size: row.size,
      plannedPairs: Number(row.planned_pairs),
    })),
    stageAssignments: stageAssignments
      .filter((row) => isFactoryStageCode(row.stage_code))
      .map((row) => ({
        id: row.id,
        workOrderId: row.work_order_id,
        stageCode: row.stage_code as FactoryStageCode,
        sequence: Number(row.sequence),
        workerId: row.worker_id,
        workerName: row.worker_name,
        targetPairs: Number(row.target_pairs),
        status: row.status,
        ratePerGoodPairSnapshot: Number(row.rate_per_good_pair_snapshot),
        cameraZone: row.camera_zone,
      })),
    productionEntries: productionEntries
      .filter((row) => isFactoryStageCode(row.stage_code))
      .map((row) => ({
        id: row.id,
        workOrderId: row.work_order_id,
        assignmentId: row.assignment_id,
        workerId: row.worker_id,
        workerName: row.worker_name,
        stageCode: row.stage_code as FactoryStageCode,
        entryDate: factoryDateOnly(row.entry_date),
        receivedPairs: Number(row.received_pairs),
        goodPairs: Number(row.good_pairs),
        rejectPairs: Number(row.reject_pairs),
        reworkPairs: Number(row.rework_pairs),
        wageRateSnapshot: Number(row.wage_rate_snapshot),
        calculatedWage: Number(row.calculated_wage),
        status: row.status,
        remarks: row.remarks,
        enteredBy: row.entered_by,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        rejectReason: factoryRejectReasons.includes(row.reject_reason as FactoryRejectReason)
          ? (row.reject_reason as FactoryRejectReason)
          : "",
        responsibleWorkerId: row.responsible_worker_id ?? "",
        reworkPossible: row.rework_possible,
        verificationNote: row.verification_note,
        verifiedBy: row.verified_by,
        verifiedAt: row.verified_at
          ? row.verified_at instanceof Date
            ? row.verified_at.toISOString()
            : row.verified_at
          : "",
      })),
    productionEntrySizes: productionEntrySizes.map((row) => ({
      id: row.id,
      productionEntryId: row.production_entry_id,
      size: row.size,
      receivedPairs: Number(row.received_pairs),
      goodPairs: Number(row.good_pairs),
      rejectPairs: Number(row.reject_pairs),
      reworkPairs: Number(row.rework_pairs),
    })),
    stageHandovers: stageHandovers
      .filter(
        (row) =>
          isFactoryStageCode(row.from_stage_code) &&
          isFactoryStageCode(row.to_stage_code),
      )
      .map((row) => ({
        id: row.id,
        workOrderId: row.work_order_id,
        fromAssignmentId: row.from_assignment_id,
        toAssignmentId: row.to_assignment_id,
        fromStageCode: row.from_stage_code as FactoryStageCode,
        toStageCode: row.to_stage_code as FactoryStageCode,
        fromWorkerId: row.from_worker_id,
        fromWorkerName: row.from_worker_name,
        toWorkerId: row.to_worker_id,
        toWorkerName: row.to_worker_name,
        sentPairs: Number(row.sent_pairs),
        receivedPairs: Number(row.received_pairs),
        discrepancyPairs: Number(row.discrepancy_pairs),
        remarks: row.remarks,
        handedOverBy: row.handed_over_by,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      })),
    stageHandoverSizes: stageHandoverSizes.map((row) => ({
      id: row.id,
      handoverId: row.handover_id,
      size: row.size,
      sentPairs: Number(row.sent_pairs),
      receivedPairs: Number(row.received_pairs),
      discrepancyPairs: Number(row.discrepancy_pairs),
    })),
    packingApprovals: packingApprovals.map((row) => ({
      id: row.id,
      workOrderId: row.work_order_id,
      packingAssignmentId: row.packing_assignment_id,
      approvedPairs: Number(row.approved_pairs),
      approvedBy: row.approved_by,
      stockMovementIds: row.stock_movement_ids ?? [],
      stockPostedBy: row.stock_posted_by,
      stockPostedAt:
        row.stock_posted_at instanceof Date
          ? row.stock_posted_at.toISOString()
          : (row.stock_posted_at ?? ""),
      note: row.note,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })),
    materialIssues: materialIssues.map((row) => ({
      id: row.id,
      workOrderId: row.work_order_id,
      materialId: row.material_id,
      materialName: row.material_name,
      unit: row.unit,
      quantity: Number(row.quantity),
      unitCostSnapshot: Number(row.unit_cost_snapshot),
      totalCost: Number(row.total_cost),
      status: row.status,
      postedBy: row.posted_by,
      postedAt:
        row.posted_at instanceof Date ? row.posted_at.toISOString() : (row.posted_at ?? ""),
      returnedQuantity: Number(row.returned_quantity),
      consumedQuantity: Number(row.consumed_quantity),
      wastageQuantity: Number(row.wastage_quantity),
      finalizedBy: row.finalized_by,
      finalizedAt: row.finalized_at
        ? row.finalized_at instanceof Date
          ? row.finalized_at.toISOString()
          : row.finalized_at
        : "",
      note: row.note,
      createdBy: row.created_by,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    })),
  };
}

export async function getFactoryData() {
  return runWithDataBackend({
    storeName: "factory",
    localJson: readLocalFactoryData,
    postgres: getFactoryDataFromPostgres,
  });
}

export async function addFactoryProductionItem(
  input: Omit<FactoryProductionItem, "id">,
) {
  const item = normalizeFactoryItem({ ...input, id: createFactoryId("FITEM") });

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      if (data.items.some((existing) => existing.code === item.code)) {
        throw new Error("Production item code already exists.");
      }
      data.items.unshift(item);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return item;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryItemRow>(
        "factory",
        `INSERT INTO factory_production_items (
          id, code, nepali_name, english_name, category, product_id, colors, sizes,
          stage_codes, standard_minutes_per_pair, status
        ) VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10, $11)
        RETURNING id, code, nepali_name, english_name, category, product_id, colors,
          sizes, stage_codes, standard_minutes_per_pair, status`,
        [
          item.id,
          item.code,
          item.nepaliName,
          item.englishName,
          item.category,
          item.productId,
          item.colors,
          item.sizes,
          item.stageCodes,
          item.standardMinutesPerPair,
          item.status,
        ],
      );
      const row = rows[0];
      return normalizeFactoryItem({
        ...item,
        productId: row.product_id ?? "",
        standardMinutesPerPair: Number(row.standard_minutes_per_pair),
      });
    },
  });
}

export async function upsertFactoryBomLine(
  input: Omit<FactoryBomLine, "id" | "materialName" | "unit"> & {
    materialName: string;
    unit: FactoryMaterialUnit;
  },
) {
  const line: FactoryBomLine = {
    ...input,
    id: createFactoryId("FBOM"),
    materialName: input.materialName.trim(),
    quantityPerPair: Math.max(0, Number(input.quantityPerPair) || 0),
    wastagePercent: Math.max(0, Number(input.wastagePercent) || 0),
  };
  if (!line.itemId || !line.materialId || !line.materialName || line.quantityPerPair <= 0) {
    throw new Error("Item, raw material and quantity per pair are required.");
  }

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const existing = data.bomLines.find(
        (entry) => entry.itemId === line.itemId && entry.materialId === line.materialId,
      );
      if (existing) Object.assign(existing, { ...line, id: existing.id });
      else data.bomLines.unshift(line);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return existing ?? line;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryBomRow>(
        "factory",
        `INSERT INTO factory_item_bom (
          id, item_id, material_id, material_name, unit, quantity_per_pair, wastage_percent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (item_id, material_id) DO UPDATE SET
          material_name = EXCLUDED.material_name,
          unit = EXCLUDED.unit,
          quantity_per_pair = EXCLUDED.quantity_per_pair,
          wastage_percent = EXCLUDED.wastage_percent,
          updated_at = now()
        RETURNING id, item_id, material_id, material_name, unit, quantity_per_pair, wastage_percent`,
        [
          line.id,
          line.itemId,
          line.materialId,
          line.materialName,
          line.unit,
          line.quantityPerPair,
          line.wastagePercent,
        ],
      );
      const row = rows[0];
      return {
        id: row.id,
        itemId: row.item_id,
        materialId: row.material_id,
        materialName: row.material_name,
        unit: row.unit,
        quantityPerPair: Number(row.quantity_per_pair),
        wastagePercent: Number(row.wastage_percent),
      };
    },
  });
}

export async function upsertFactoryStageRate(input: Omit<FactoryStageRate, "id">) {
  if (!input.itemId || !isFactoryStageCode(input.stageCode)) {
    throw new Error("Production item and valid stage are required.");
  }
  const rate: FactoryStageRate = {
    ...input,
    id: createFactoryId("FRATE"),
    ratePerGoodPair: Math.max(0, Math.round((Number(input.ratePerGoodPair) || 0) * 100) / 100),
  };

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const existing = data.stageRates.find(
        (entry) => entry.itemId === rate.itemId && entry.stageCode === rate.stageCode,
      );
      if (existing) Object.assign(existing, { ...rate, id: existing.id });
      else data.stageRates.unshift(rate);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return existing ?? rate;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryStageRateRow>(
        "factory",
        `INSERT INTO factory_item_stage_rates (id, item_id, stage_code, rate_per_good_pair)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (item_id, stage_code) DO UPDATE SET
           rate_per_good_pair = EXCLUDED.rate_per_good_pair,
           updated_at = now()
         RETURNING id, item_id, stage_code, rate_per_good_pair`,
        [rate.id, rate.itemId, rate.stageCode, rate.ratePerGoodPair],
      );
      return {
        id: rows[0].id,
        itemId: rows[0].item_id,
        stageCode: rows[0].stage_code as FactoryStageCode,
        ratePerGoodPair: Number(rows[0].rate_per_good_pair),
      };
    },
  });
}

export async function upsertFactoryWorkerLink(input: FactoryWorkerLink) {
  const link = {
    employeeId: input.employeeId.trim(),
    stageCodes: [...new Set(input.stageCodes)].filter(isFactoryStageCode),
    active: input.active,
  };
  if (!link.employeeId || link.stageCodes.length === 0) {
    throw new Error("Employee and at least one factory stage are required.");
  }

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const existing = data.workerLinks.find((entry) => entry.employeeId === link.employeeId);
      if (existing) Object.assign(existing, link);
      else data.workerLinks.unshift(link);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return existing ?? link;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryWorkerLinkRow>(
        "factory",
        `INSERT INTO factory_worker_links (employee_id, stage_codes, active)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id) DO UPDATE SET
           stage_codes = EXCLUDED.stage_codes,
           active = EXCLUDED.active,
           updated_at = now()
         RETURNING employee_id, stage_codes, active`,
        [link.employeeId, link.stageCodes, link.active],
      );
      return {
        employeeId: rows[0].employee_id,
        stageCodes: rows[0].stage_codes.filter(isFactoryStageCode),
        active: rows[0].active,
      };
    },
  });
}

function nextWorkOrderIdentity() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return {
    workOrderNumber: `WO-${date}-${time}-${suffix}`,
    lotNumber: `LOT-${date}-${suffix}`,
  };
}

export function normalizeWorkOrderSizes(
  rows: Array<{ size: string; plannedPairs: number }>,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const size = row.size.trim();
    const pairs = Math.max(0, Math.round(Number(row.plannedPairs) || 0));
    if (size && pairs > 0) totals.set(size, (totals.get(size) ?? 0) + pairs);
  }
  return [...totals].map(([size, plannedPairs]) => ({ size, plannedPairs }));
}

export async function addFactoryWorkOrder(input: {
  item: FactoryProductionItem;
  color: string;
  createdDate: string;
  dueDate: string;
  priority: FactoryWorkOrderPriority;
  remarks: string;
  createdBy: string;
  sizes: Array<{ size: string; plannedPairs: number }>;
}) {
  const sizes = normalizeWorkOrderSizes(input.sizes);
  if (!input.item.id || !input.color.trim() || sizes.length === 0) {
    throw new Error("Production item, colour and at least one size quantity are required.");
  }
  const identity = nextWorkOrderIdentity();
  const workOrder: FactoryWorkOrder = {
    id: createFactoryId("FWO"),
    ...identity,
    itemId: input.item.id,
    itemCode: input.item.code,
    itemName: input.item.englishName,
    color: input.color.trim(),
    createdDate: input.createdDate,
    dueDate: input.dueDate,
    priority: input.priority,
    currentStageCode: input.item.stageCodes[0] ?? "",
    status: "Draft",
    totalPairs: sizes.reduce((sum, row) => sum + row.plannedPairs, 0),
    remarks: input.remarks.trim(),
    createdBy: input.createdBy.trim(),
  };
  const sizeRows = sizes.map((row) => ({
    id: createFactoryId("FWOS"),
    workOrderId: workOrder.id,
    ...row,
  }));

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      data.workOrders.unshift(workOrder);
      data.workOrderSizes.push(...sizeRows);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return { workOrder, sizes: sizeRows };
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        await db.query(
          `INSERT INTO factory_work_orders (
            id, work_order_number, lot_number, item_id, item_code, item_name,
            color, created_date, due_date, priority, current_stage_code, status,
            total_pairs, remarks, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            workOrder.id,
            workOrder.workOrderNumber,
            workOrder.lotNumber,
            workOrder.itemId,
            workOrder.itemCode,
            workOrder.itemName,
            workOrder.color,
            workOrder.createdDate,
            workOrder.dueDate,
            workOrder.priority,
            workOrder.currentStageCode,
            workOrder.status,
            workOrder.totalPairs,
            workOrder.remarks,
            workOrder.createdBy,
          ],
        );
        for (const row of sizeRows) {
          await db.query(
            `INSERT INTO factory_work_order_sizes
              (id, work_order_id, size, planned_pairs) VALUES ($1, $2, $3, $4)`,
            [row.id, row.workOrderId, row.size, row.plannedPairs],
          );
        }
        return { workOrder, sizes: sizeRows };
      }),
  });
}

export type FactoryReleaseAssignmentInput = {
  stageCode: FactoryStageCode;
  workerId: string;
  workerName: string;
  ratePerGoodPairSnapshot: number;
  cameraZone: string;
};

export function validateFactoryRelease(input: {
  item: FactoryProductionItem;
  bomLines: FactoryBomLine[];
  assignments: FactoryReleaseAssignmentInput[];
}) {
  if (input.bomLines.length === 0) throw new Error("Configure the item BOM before release.");
  const byStage = new Map(input.assignments.map((entry) => [entry.stageCode, entry]));
  for (const stageCode of input.item.stageCodes) {
    const assignment = byStage.get(stageCode);
    if (!assignment?.workerId) throw new Error(`Assign a worker for ${stageCode}.`);
    if (assignment.ratePerGoodPairSnapshot < 0) {
      throw new Error(`Invalid wage rate for ${stageCode}.`);
    }
  }
  if (byStage.size !== input.item.stageCodes.length) {
    throw new Error("Assignments must match the configured item stages.");
  }
}

export async function releaseFactoryWorkOrder(input: {
  workOrder: FactoryWorkOrder;
  item: FactoryProductionItem;
  bomLines: FactoryBomLine[];
  assignments: FactoryReleaseAssignmentInput[];
}) {
  if (input.workOrder.status !== "Draft") throw new Error("Only a Draft Work Order can be released.");
  validateFactoryRelease(input);
  const assignments: FactoryStageAssignment[] = input.item.stageCodes.map((stageCode, index) => {
    const source = input.assignments.find((entry) => entry.stageCode === stageCode)!;
    return {
      id: createFactoryId("FASSIGN"),
      workOrderId: input.workOrder.id,
      stageCode,
      sequence: index + 1,
      workerId: source.workerId,
      workerName: source.workerName,
      targetPairs: input.workOrder.totalPairs,
      status: index === 0 ? "Ready" : "Waiting",
      ratePerGoodPairSnapshot:
        Math.max(0, Math.round(source.ratePerGoodPairSnapshot * 100) / 100),
      cameraZone: source.cameraZone.trim(),
    };
  });

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const order = data.workOrders.find((entry) => entry.id === input.workOrder.id);
      if (!order || order.status !== "Draft") throw new Error("Draft Work Order was not found.");
      order.status = "Released";
      order.currentStageCode = input.item.stageCodes[0] ?? "";
      data.stageAssignments.push(...assignments);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return assignments;
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        const updated = await db.query<{ id: string }>(
          `UPDATE factory_work_orders
           SET status = 'Released', current_stage_code = $2, updated_at = now()
           WHERE id = $1 AND status = 'Draft'
           RETURNING id`,
          [input.workOrder.id, input.item.stageCodes[0] ?? ""],
        );
        if (!updated[0]) throw new Error("Draft Work Order was not found or already released.");
        for (const assignment of assignments) {
          await db.query(
            `INSERT INTO factory_stage_assignments (
              id, work_order_id, stage_code, sequence, worker_id, worker_name,
              target_pairs, status, rate_per_good_pair_snapshot, camera_zone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              assignment.id,
              assignment.workOrderId,
              assignment.stageCode,
              assignment.sequence,
              assignment.workerId,
              assignment.workerName,
              assignment.targetPairs,
              assignment.status,
              assignment.ratePerGoodPairSnapshot,
              assignment.cameraZone,
            ],
          );
        }
        return assignments;
      }),
  });
}

export type FactoryProductionSizeInput = {
  size: string;
  goodPairs: number;
  rejectPairs: number;
  reworkPairs: number;
};

export function normalizeProductionSizeEntries(rows: FactoryProductionSizeInput[]) {
  return rows
    .map((row) => ({
      size: row.size.trim(),
      goodPairs: Math.max(0, Math.round(Number(row.goodPairs) || 0)),
      rejectPairs: Math.max(0, Math.round(Number(row.rejectPairs) || 0)),
      reworkPairs: Math.max(0, Math.round(Number(row.reworkPairs) || 0)),
    }))
    .filter(
      (row) => row.size && row.goodPairs + row.rejectPairs + row.reworkPairs > 0,
    )
    .map((row) => ({
      ...row,
      receivedPairs: row.goodPairs + row.rejectPairs + row.reworkPairs,
    }));
}

export async function addFactoryProductionEntry(input: {
  workOrder: FactoryWorkOrder;
  assignment: FactoryStageAssignment;
  plannedSizes: FactoryWorkOrderSize[];
  existingEntries: FactoryProductionEntry[];
  existingEntrySizes: FactoryProductionEntrySize[];
  sizes: FactoryProductionSizeInput[];
  remarks: string;
  enteredBy: string;
}) {
  if (!["Ready", "In Progress"].includes(input.assignment.status)) {
    throw new Error("This stage is not ready for production entry.");
  }
  const sizes = normalizeProductionSizeEntries(input.sizes);
  if (sizes.length === 0) throw new Error("Enter at least one completed size quantity.");

  const assignmentEntryIds = new Set(
    input.existingEntries
      .filter(
        (entry) =>
          entry.assignmentId === input.assignment.id && entry.status !== "Rejected",
      )
      .map((entry) => entry.id),
  );
  for (const row of sizes) {
    const planned = input.plannedSizes.find((entry) => entry.size === row.size)?.plannedPairs ?? 0;
    const alreadyGood = input.existingEntrySizes
      .filter(
        (entry) =>
          assignmentEntryIds.has(entry.productionEntryId) && entry.size === row.size,
      )
      .reduce((sum, entry) => sum + entry.goodPairs, 0);
    if (row.goodPairs > planned - alreadyGood) {
      throw new Error(`Size ${row.size} exceeds its remaining good-pair target.`);
    }
  }

  const totals = sizes.reduce(
    (sum, row) => ({
      receivedPairs: sum.receivedPairs + row.receivedPairs,
      goodPairs: sum.goodPairs + row.goodPairs,
      rejectPairs: sum.rejectPairs + row.rejectPairs,
      reworkPairs: sum.reworkPairs + row.reworkPairs,
    }),
    { receivedPairs: 0, goodPairs: 0, rejectPairs: 0, reworkPairs: 0 },
  );
  const entry: FactoryProductionEntry = {
    id: createFactoryId("FENTRY"),
    workOrderId: input.workOrder.id,
    assignmentId: input.assignment.id,
    workerId: input.assignment.workerId,
    workerName: input.assignment.workerName,
    stageCode: input.assignment.stageCode,
    entryDate: new Date().toISOString().slice(0, 10),
    ...totals,
    wageRateSnapshot: input.assignment.ratePerGoodPairSnapshot,
    calculatedWage:
      Math.round(totals.goodPairs * input.assignment.ratePerGoodPairSnapshot * 100) / 100,
    status: "Submitted",
    remarks: input.remarks.trim(),
    enteredBy: input.enteredBy.trim(),
    createdAt: new Date().toISOString(),
    rejectReason: "",
    responsibleWorkerId: "",
    reworkPossible: false,
    verificationNote: "",
    verifiedBy: "",
    verifiedAt: "",
  };
  const sizeRows: FactoryProductionEntrySize[] = sizes.map((row) => ({
    id: createFactoryId("FESIZE"),
    productionEntryId: entry.id,
    ...row,
  }));

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      data.productionEntries.unshift(entry);
      data.productionEntrySizes.push(...sizeRows);
      const assignment = data.stageAssignments.find((row) => row.id === input.assignment.id);
      if (assignment?.status === "Ready") assignment.status = "In Progress";
      const order = data.workOrders.find((row) => row.id === input.workOrder.id);
      if (order?.status === "Released") order.status = "In Progress";
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return { entry, sizes: sizeRows };
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        await db.query(
          `INSERT INTO factory_production_entries (
            id, work_order_id, assignment_id, worker_id, worker_name, stage_code,
            entry_date, received_pairs, good_pairs, reject_pairs, rework_pairs,
            wage_rate_snapshot, calculated_wage, status, remarks, entered_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            entry.id,
            entry.workOrderId,
            entry.assignmentId,
            entry.workerId,
            entry.workerName,
            entry.stageCode,
            entry.entryDate,
            entry.receivedPairs,
            entry.goodPairs,
            entry.rejectPairs,
            entry.reworkPairs,
            entry.wageRateSnapshot,
            entry.calculatedWage,
            entry.status,
            entry.remarks,
            entry.enteredBy,
          ],
        );
        for (const row of sizeRows) {
          await db.query(
            `INSERT INTO factory_production_entry_sizes (
              id, production_entry_id, size, received_pairs, good_pairs,
              reject_pairs, rework_pairs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              row.id,
              row.productionEntryId,
              row.size,
              row.receivedPairs,
              row.goodPairs,
              row.rejectPairs,
              row.reworkPairs,
            ],
          );
        }
        await db.query(
          `UPDATE factory_stage_assignments
           SET status = CASE WHEN status = 'Ready' THEN 'In Progress' ELSE status END,
             updated_at = now()
           WHERE id = $1 AND status IN ('Ready', 'In Progress')`,
          [input.assignment.id],
        );
        await db.query(
          `UPDATE factory_work_orders
           SET status = CASE WHEN status = 'Released' THEN 'In Progress' ELSE status END,
             updated_at = now()
           WHERE id = $1`,
          [input.workOrder.id],
        );
        return { entry, sizes: sizeRows };
      }),
  });
}

export async function verifyFactoryProductionEntry(input: {
  entry: FactoryProductionEntry;
  decision: "Verified" | "Rejected";
  rejectReason: FactoryRejectReason | "";
  responsibleWorkerId: string;
  reworkPossible: boolean;
  verificationNote: string;
  verifiedBy: string;
}) {
  if (input.entry.status !== "Submitted") {
    throw new Error("Only a Submitted production entry can be verified.");
  }
  if (
    input.decision === "Verified" &&
    (input.entry.rejectPairs > 0 || input.entry.reworkPairs > 0) &&
    !input.rejectReason
  ) {
    throw new Error("Select a QC reason when reject or rework quantity exists.");
  }
  if (
    input.decision === "Verified" &&
    (input.entry.rejectPairs > 0 || input.entry.reworkPairs > 0) &&
    input.rejectReason !== "Material defect" &&
    !input.responsibleWorkerId
  ) {
    throw new Error("Select the responsible worker for this QC issue.");
  }
  if (input.decision === "Rejected" && !input.verificationNote.trim()) {
    throw new Error("A note is required when rejecting a submitted entry.");
  }
  const verifiedAt = new Date().toISOString();

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const entry = data.productionEntries.find((row) => row.id === input.entry.id);
      if (!entry || entry.status !== "Submitted") {
        throw new Error("Submitted production entry was not found.");
      }
      Object.assign(entry, {
        status: input.decision,
        rejectReason: input.rejectReason,
        responsibleWorkerId: input.responsibleWorkerId,
        reworkPossible: input.reworkPossible,
        verificationNote: input.verificationNote.trim(),
        verifiedBy: input.verifiedBy.trim(),
        verifiedAt,
      });
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return entry;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryProductionEntryRow>(
        "factory",
        `UPDATE factory_production_entries
         SET status = $2, reject_reason = $3, responsible_worker_id = NULLIF($4, ''),
           rework_possible = $5, verification_note = $6, verified_by = $7,
           verified_at = $8, updated_at = now()
         WHERE id = $1 AND status = 'Submitted'
         RETURNING id, work_order_id, assignment_id, worker_id, worker_name, stage_code,
           entry_date, received_pairs, good_pairs, reject_pairs, rework_pairs,
           wage_rate_snapshot, calculated_wage, status, remarks, entered_by, created_at,
           reject_reason, responsible_worker_id, rework_possible, verification_note,
           verified_by, verified_at`,
        [
          input.entry.id,
          input.decision,
          input.rejectReason,
          input.responsibleWorkerId,
          input.reworkPossible,
          input.verificationNote.trim(),
          input.verifiedBy.trim(),
          verifiedAt,
        ],
      );
      if (!rows[0]) throw new Error("Submitted production entry was not found.");
      return { ...input.entry, status: input.decision, verifiedAt };
    },
  });
}

export function getFactoryAssignmentSizePlan(
  data: Pick<FactoryData, "workOrderSizes" | "stageHandovers" | "stageHandoverSizes">,
  assignment: FactoryStageAssignment,
) {
  if (assignment.sequence === 1) {
    return data.workOrderSizes.filter((row) => row.workOrderId === assignment.workOrderId);
  }
  const incomingIds = new Set(
    data.stageHandovers
      .filter((handover) => handover.toAssignmentId === assignment.id)
      .map((handover) => handover.id),
  );
  const receivedBySize = new Map<string, number>();
  for (const row of data.stageHandoverSizes) {
    if (incomingIds.has(row.handoverId)) {
      receivedBySize.set(row.size, (receivedBySize.get(row.size) ?? 0) + row.receivedPairs);
    }
  }
  return [...receivedBySize].map(([size, plannedPairs]) => ({
    id: `received-${assignment.id}-${size}`,
    workOrderId: assignment.workOrderId,
    size,
    plannedPairs,
  }));
}

export type FactoryHandoverSizeInput = {
  size: string;
  sentPairs: number;
  receivedPairs: number;
};

export function normalizeFactoryHandoverSizes(rows: FactoryHandoverSizeInput[]) {
  return rows
    .map((row) => {
      const sentPairs = Math.max(0, Math.round(Number(row.sentPairs) || 0));
      const receivedPairs = Math.max(0, Math.round(Number(row.receivedPairs) || 0));
      if (receivedPairs > sentPairs) {
        throw new Error(`Size ${row.size}: received quantity cannot exceed sent quantity.`);
      }
      return {
        size: row.size.trim(),
        sentPairs,
        receivedPairs,
        discrepancyPairs: sentPairs - receivedPairs,
      };
    })
    .filter((row) => row.size && row.sentPairs > 0);
}

export async function addFactoryStageHandover(input: {
  workOrder: FactoryWorkOrder;
  fromAssignment: FactoryStageAssignment;
  toAssignment: FactoryStageAssignment;
  verifiedEntries: FactoryProductionEntry[];
  productionEntrySizes: FactoryProductionEntrySize[];
  previousHandovers: FactoryStageHandover[];
  previousHandoverSizes: FactoryStageHandoverSize[];
  sizes: FactoryHandoverSizeInput[];
  remarks: string;
  handedOverBy: string;
}) {
  if (
    input.fromAssignment.workOrderId !== input.toAssignment.workOrderId ||
    input.toAssignment.sequence !== input.fromAssignment.sequence + 1
  ) {
    throw new Error("Handover is allowed only to the next stage of the same Work Order.");
  }
  const sizes = normalizeFactoryHandoverSizes(input.sizes);
  if (sizes.length === 0) throw new Error("Enter at least one size quantity to hand over.");
  const verifiedEntryIds = new Set(
    input.verifiedEntries
      .filter(
        (entry) =>
          entry.assignmentId === input.fromAssignment.id && entry.status === "Verified",
      )
      .map((entry) => entry.id),
  );
  const previousHandoverIds = new Set(
    input.previousHandovers
      .filter((row) => row.fromAssignmentId === input.fromAssignment.id)
      .map((row) => row.id),
  );
  for (const row of sizes) {
    const verifiedGood = input.productionEntrySizes
      .filter(
        (entry) =>
          verifiedEntryIds.has(entry.productionEntryId) && entry.size === row.size,
      )
      .reduce((sum, entry) => sum + entry.goodPairs, 0);
    const alreadySent = input.previousHandoverSizes
      .filter(
        (entry) =>
          previousHandoverIds.has(entry.handoverId) && entry.size === row.size,
      )
      .reduce((sum, entry) => sum + entry.sentPairs, 0);
    if (row.sentPairs > verifiedGood - alreadySent) {
      throw new Error(`Size ${row.size} exceeds verified good quantity available to send.`);
    }
  }

  const totals = sizes.reduce(
    (sum, row) => ({
      sentPairs: sum.sentPairs + row.sentPairs,
      receivedPairs: sum.receivedPairs + row.receivedPairs,
      discrepancyPairs: sum.discrepancyPairs + row.discrepancyPairs,
    }),
    { sentPairs: 0, receivedPairs: 0, discrepancyPairs: 0 },
  );
  if (totals.discrepancyPairs > 0 && !input.remarks.trim()) {
    throw new Error("Explain the sent/received discrepancy in remarks.");
  }
  const handover: FactoryStageHandover = {
    id: createFactoryId("FHAND"),
    workOrderId: input.workOrder.id,
    fromAssignmentId: input.fromAssignment.id,
    toAssignmentId: input.toAssignment.id,
    fromStageCode: input.fromAssignment.stageCode,
    toStageCode: input.toAssignment.stageCode,
    fromWorkerId: input.fromAssignment.workerId,
    fromWorkerName: input.fromAssignment.workerName,
    toWorkerId: input.toAssignment.workerId,
    toWorkerName: input.toAssignment.workerName,
    ...totals,
    remarks: input.remarks.trim(),
    handedOverBy: input.handedOverBy.trim(),
    createdAt: new Date().toISOString(),
  };
  const sizeRows: FactoryStageHandoverSize[] = sizes.map((row) => ({
    id: createFactoryId("FHSIZE"),
    handoverId: handover.id,
    ...row,
  }));
  const previousSent = input.previousHandovers
    .filter((row) => row.fromAssignmentId === input.fromAssignment.id)
    .reduce((sum, row) => sum + row.sentPairs, 0);
  const sourceCompleted = previousSent + handover.sentPairs >= input.fromAssignment.targetPairs;

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      data.stageHandovers.unshift(handover);
      data.stageHandoverSizes.push(...sizeRows);
      const source = data.stageAssignments.find((row) => row.id === input.fromAssignment.id);
      const target = data.stageAssignments.find((row) => row.id === input.toAssignment.id);
      if (sourceCompleted && source) source.status = "Completed";
      if (target?.status === "Waiting") target.status = "Ready";
      const order = data.workOrders.find((row) => row.id === input.workOrder.id);
      if (order) order.currentStageCode = input.toAssignment.stageCode;
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return { handover, sizes: sizeRows };
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        await db.query(
          "SELECT id FROM factory_stage_assignments WHERE id = $1 FOR UPDATE",
          [input.fromAssignment.id],
        );
        for (const row of sizeRows) {
          const available = await db.query<{ available: number | string }>(
            `SELECT
              COALESCE((
                SELECT SUM(s.good_pairs)
                FROM factory_production_entry_sizes s
                JOIN factory_production_entries e ON e.id = s.production_entry_id
                WHERE e.assignment_id = $1 AND e.status = 'Verified' AND s.size = $2
              ), 0) - COALESCE((
                SELECT SUM(hs.sent_pairs)
                FROM factory_stage_handover_sizes hs
                JOIN factory_stage_handovers h ON h.id = hs.handover_id
                WHERE h.from_assignment_id = $1 AND hs.size = $2
              ), 0) AS available`,
            [input.fromAssignment.id, row.size],
          );
          if (row.sentPairs > Number(available[0]?.available ?? 0)) {
            throw new Error(`Size ${row.size} no longer has enough verified quantity.`);
          }
        }
        await db.query(
          `INSERT INTO factory_stage_handovers (
            id, work_order_id, from_assignment_id, to_assignment_id,
            from_stage_code, to_stage_code, from_worker_id, from_worker_name,
            to_worker_id, to_worker_name, sent_pairs, received_pairs,
            discrepancy_pairs, remarks, handed_over_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            handover.id,
            handover.workOrderId,
            handover.fromAssignmentId,
            handover.toAssignmentId,
            handover.fromStageCode,
            handover.toStageCode,
            handover.fromWorkerId,
            handover.fromWorkerName,
            handover.toWorkerId,
            handover.toWorkerName,
            handover.sentPairs,
            handover.receivedPairs,
            handover.discrepancyPairs,
            handover.remarks,
            handover.handedOverBy,
          ],
        );
        for (const row of sizeRows) {
          await db.query(
            `INSERT INTO factory_stage_handover_sizes (
              id, handover_id, size, sent_pairs, received_pairs, discrepancy_pairs
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              row.id,
              row.handoverId,
              row.size,
              row.sentPairs,
              row.receivedPairs,
              row.discrepancyPairs,
            ],
          );
        }
        await db.query(
          `UPDATE factory_stage_assignments
           SET status = CASE
             WHEN (
               SELECT COALESCE(SUM(sent_pairs), 0)
               FROM factory_stage_handovers
               WHERE from_assignment_id = $1
             ) >= target_pairs THEN 'Completed'
             ELSE status
           END, updated_at = now()
           WHERE id = $1`,
          [input.fromAssignment.id],
        );
        await db.query(
          `UPDATE factory_stage_assignments
           SET status = CASE WHEN status = 'Waiting' THEN 'Ready' ELSE status END,
             updated_at = now()
           WHERE id = $1`,
          [input.toAssignment.id],
        );
        await db.query(
          `UPDATE factory_work_orders
           SET current_stage_code = $2, updated_at = now() WHERE id = $1`,
          [input.workOrder.id, input.toAssignment.stageCode],
        );
        return { handover, sizes: sizeRows };
      }),
  });
}

export function getFactoryPackingReadiness(
  data: Pick<
    FactoryData,
    | "workOrderSizes"
    | "stageAssignments"
    | "productionEntries"
    | "productionEntrySizes"
    | "packingApprovals"
  >,
  workOrder: FactoryWorkOrder,
) {
  const assignments = data.stageAssignments
    .filter((row) => row.workOrderId === workOrder.id)
    .sort((left, right) => left.sequence - right.sequence);
  const packingAssignment = assignments.at(-1);
  const entries = packingAssignment
    ? data.productionEntries.filter((row) => row.assignmentId === packingAssignment.id)
    : [];
  const verifiedIds = new Set(
    entries.filter((entry) => entry.status === "Verified").map((entry) => entry.id),
  );
  const sizes = data.workOrderSizes
    .filter((row) => row.workOrderId === workOrder.id)
    .map((row) => {
      const verifiedGood = data.productionEntrySizes
        .filter(
          (entry) =>
            verifiedIds.has(entry.productionEntryId) && entry.size === row.size,
        )
        .reduce((sum, entry) => sum + entry.goodPairs, 0);
      return {
        size: row.size,
        plannedPairs: row.plannedPairs,
        verifiedGood,
        shortagePairs: Math.max(0, row.plannedPairs - verifiedGood),
      };
    });
  const pendingEntries = entries.filter((entry) => entry.status === "Submitted").length;
  const existingApproval = data.packingApprovals.find(
    (approval) => approval.workOrderId === workOrder.id,
  );

  return {
    packingAssignment,
    sizes,
    pendingEntries,
    approvedPairs: sizes.reduce((sum, row) => sum + row.verifiedGood, 0),
    ready:
      Boolean(packingAssignment) &&
      !existingApproval &&
      pendingEntries === 0 &&
      sizes.length > 0 &&
      sizes.every((row) => row.shortagePairs === 0),
    existingApproval,
  };
}

export async function approveFactoryPacking(input: {
  data: FactoryData;
  workOrder: FactoryWorkOrder;
  approvedBy: string;
  note: string;
}) {
  if (!["Released", "In Progress"].includes(input.workOrder.status)) {
    throw new Error("This Work Order is not awaiting final packing approval.");
  }
  const readiness = getFactoryPackingReadiness(input.data, input.workOrder);
  if (!readiness.packingAssignment || !readiness.ready) {
    throw new Error("Packing cannot be approved until every planned size is verified.");
  }
  const approval: FactoryPackingApproval = {
    id: createFactoryId("FPACK"),
    workOrderId: input.workOrder.id,
    packingAssignmentId: readiness.packingAssignment.id,
    approvedPairs: readiness.approvedPairs,
    approvedBy: input.approvedBy.trim(),
    stockMovementIds: [],
    stockPostedBy: "",
    stockPostedAt: "",
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
  };

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const liveReadiness = getFactoryPackingReadiness(data, input.workOrder);
      if (!liveReadiness.ready) throw new Error("Packing readiness changed; review again.");
      data.packingApprovals.unshift(approval);
      const assignment = data.stageAssignments.find(
        (row) => row.id === approval.packingAssignmentId,
      );
      if (assignment) assignment.status = "Completed";
      const order = data.workOrders.find((row) => row.id === input.workOrder.id);
      if (order) order.status = "Ready for Stock";
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return approval;
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        await db.query(
          "SELECT id FROM factory_work_orders WHERE id = $1 FOR UPDATE",
          [input.workOrder.id],
        );
        const readinessRows = await db.query<{
          size: string;
          planned_pairs: number | string;
          verified_good: number | string;
        }>(
          `SELECT s.size, s.planned_pairs,
            COALESCE(SUM(es.good_pairs) FILTER (WHERE e.status = 'Verified'), 0) AS verified_good
           FROM factory_work_order_sizes s
           LEFT JOIN factory_stage_assignments a
             ON a.work_order_id = s.work_order_id
            AND a.sequence = (
              SELECT MAX(a2.sequence) FROM factory_stage_assignments a2
              WHERE a2.work_order_id = s.work_order_id
            )
           LEFT JOIN factory_production_entries e ON e.assignment_id = a.id
           LEFT JOIN factory_production_entry_sizes es
             ON es.production_entry_id = e.id AND es.size = s.size
           WHERE s.work_order_id = $1
           GROUP BY s.size, s.planned_pairs`,
          [input.workOrder.id],
        );
        const pending = await db.query<{ count: number | string }>(
          `SELECT COUNT(*) AS count
           FROM factory_production_entries
           WHERE assignment_id = $1 AND status = 'Submitted'`,
          [approval.packingAssignmentId],
        );
        if (
          Number(pending[0]?.count ?? 0) > 0 ||
          readinessRows.length === 0 ||
          readinessRows.some(
            (row) => Number(row.verified_good) < Number(row.planned_pairs),
          )
        ) {
          throw new Error("Packing readiness changed; review again.");
        }
        await db.query(
          `INSERT INTO factory_packing_approvals (
            id, work_order_id, packing_assignment_id, approved_pairs, approved_by, note
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            approval.id,
            approval.workOrderId,
            approval.packingAssignmentId,
            approval.approvedPairs,
            approval.approvedBy,
            approval.note,
          ],
        );
        await db.query(
          `UPDATE factory_stage_assignments
           SET status = 'Completed', updated_at = now() WHERE id = $1`,
          [approval.packingAssignmentId],
        );
        await db.query(
          `UPDATE factory_work_orders
           SET status = 'Ready for Stock', updated_at = now() WHERE id = $1`,
          [approval.workOrderId],
        );
        return approval;
      }),
  });
}

export function validateFactoryStockPosting(
  data: FactoryData,
  workOrder: FactoryWorkOrder,
) {
  if (workOrder.status !== "Ready for Stock") {
    throw new Error("Only a Work Order marked Ready for Stock can be posted.");
  }
  const approval = data.packingApprovals.find(
    (entry) => entry.workOrderId === workOrder.id,
  );
  if (!approval) throw new Error("Packing approval was not found.");
  if (approval.stockPostedAt || approval.stockMovementIds.length > 0) {
    throw new Error("This Work Order is already posted to finished stock.");
  }
  const sizes = data.workOrderSizes.filter(
    (entry) => entry.workOrderId === workOrder.id && entry.plannedPairs > 0,
  );
  if (
    sizes.length === 0 ||
    sizes.reduce((sum, entry) => sum + entry.plannedPairs, 0) !==
      approval.approvedPairs
  ) {
    throw new Error("Size plan no longer reconciles with packing approval.");
  }
  const issues = data.materialIssues.filter(
    (entry) => entry.workOrderId === workOrder.id && entry.status !== "Cancelled",
  );
  if (issues.length === 0) {
    throw new Error("Raw materials must be issued and finalized before stock posting.");
  }
  if (issues.some((entry) => entry.status !== "Posted" || !entry.finalizedAt)) {
    throw new Error("Finalize every raw-material issue before stock posting.");
  }
  return { approval, sizes };
}

export async function postFactoryFinishedStock(input: {
  data: FactoryData;
  workOrder: FactoryWorkOrder;
  postedBy: string;
}) {
  const posting = validateFactoryStockPosting(input.data, input.workOrder);
  const postedAt = new Date().toISOString();
  const movementNote = `Factory ${input.workOrder.workOrderNumber} · ${input.workOrder.color}`;

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const operations = await import("@/lib/operations");
      const liveData = await readLocalFactoryData();
      const liveOrder = liveData.workOrders.find(
        (entry) => entry.id === input.workOrder.id,
      );
      if (!liveOrder) throw new Error("Work Order was not found.");
      const livePosting = validateFactoryStockPosting(liveData, liveOrder);
      const movements = [];
      for (const size of livePosting.sizes) {
        movements.push(
          await operations.addStockMovement({
            design: liveOrder.itemName,
            channel: "Factory",
            sizeRun: size.size,
            type: "Production In",
            pairs: size.plannedPairs,
            note: movementNote,
          }),
        );
      }
      livePosting.approval.stockMovementIds = movements.map((entry) => entry.id);
      livePosting.approval.stockPostedBy = input.postedBy.trim();
      livePosting.approval.stockPostedAt = postedAt;
      liveOrder.status = "Completed";
      await writeFileAtomic(factoryDataPath, JSON.stringify(liveData, null, 2));
      return {
        approval: livePosting.approval,
        movements,
        postedPairs: movements.reduce((sum, entry) => sum + entry.pairs, 0),
      };
    },
    postgres: () =>
      transactionPostgres("factory finished stock", async (db) => {
        const approvals = await db.query<{
          id: string;
          approved_pairs: number | string;
          stock_movement_ids: string[];
          stock_posted_at: Date | string | null;
        }>(
          `SELECT id, approved_pairs, stock_movement_ids, stock_posted_at
           FROM factory_packing_approvals
           WHERE work_order_id = $1 FOR UPDATE`,
          [input.workOrder.id],
        );
        const approval = approvals[0];
        if (
          !approval ||
          approval.stock_posted_at ||
          (approval.stock_movement_ids ?? []).length > 0
        ) {
          throw new Error("Packing approval was not found or stock is already posted.");
        }
        const orders = await db.query<{ status: FactoryWorkOrderStatus }>(
          "SELECT status FROM factory_work_orders WHERE id = $1 FOR UPDATE",
          [input.workOrder.id],
        );
        if (orders[0]?.status !== "Ready for Stock") {
          throw new Error("Work Order is no longer Ready for Stock.");
        }
        const sizes = await db.query<{ size: string; planned_pairs: number | string }>(
          `SELECT size, planned_pairs FROM factory_work_order_sizes
           WHERE work_order_id = $1 AND planned_pairs > 0 ORDER BY size`,
          [input.workOrder.id],
        );
        const sizeTotal = sizes.reduce(
          (sum, entry) => sum + Number(entry.planned_pairs),
          0,
        );
        if (sizes.length === 0 || sizeTotal !== Number(approval.approved_pairs)) {
          throw new Error("Size plan no longer reconciles with packing approval.");
        }
        const materialState = await db.query<{
          active_count: number | string;
          pending_count: number | string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE status <> 'Cancelled') AS active_count,
             COUNT(*) FILTER (
               WHERE status <> 'Cancelled'
                 AND (status <> 'Posted' OR finalized_at IS NULL)
             ) AS pending_count
           FROM factory_material_issues WHERE work_order_id = $1`,
          [input.workOrder.id],
        );
        if (
          Number(materialState[0]?.active_count ?? 0) === 0 ||
          Number(materialState[0]?.pending_count ?? 0) > 0
        ) {
          throw new Error("Raw-material issues must be finalized before stock posting.");
        }
        const movements = [];
        for (const size of sizes) {
          movements.push(
            await insertStockMovement(db, {
              design: input.workOrder.itemName,
              channel: "Factory",
              sizeRun: size.size,
              type: "Production In",
              pairs: Number(size.planned_pairs),
              note: movementNote,
            }),
          );
        }
        const movementIds = movements.map((entry) => entry.id);
        await db.query(
          `UPDATE factory_packing_approvals
           SET stock_movement_ids = $2, stock_posted_by = $3,
             stock_posted_at = $4
           WHERE id = $1 AND stock_posted_at IS NULL`,
          [approval.id, movementIds, input.postedBy.trim(), postedAt],
        );
        await db.query(
          `UPDATE factory_work_orders
           SET status = 'Completed', updated_at = now() WHERE id = $1`,
          [input.workOrder.id],
        );
        return {
          approval: {
            ...posting.approval,
            stockMovementIds: movementIds,
            stockPostedBy: input.postedBy.trim(),
            stockPostedAt: postedAt,
          },
          movements,
          postedPairs: sizeTotal,
        };
      }),
  });
}

export function getFactoryMaterialPlan(input: {
  workOrder: FactoryWorkOrder;
  bomLines: FactoryBomLine[];
  materialIssues: FactoryMaterialIssue[];
}) {
  return input.bomLines
    .filter((line) => line.itemId === input.workOrder.itemId)
    .map((line) => {
      const requirement = calculateBomRequirement(line, input.workOrder.totalPairs);
      const allocatedQuantity = input.materialIssues
        .filter(
          (issue) =>
            issue.workOrderId === input.workOrder.id &&
            issue.materialId === line.materialId &&
            issue.status !== "Cancelled",
        )
        .reduce((sum, issue) => sum + issue.quantity, 0);
      return {
        ...line,
        plannedQuantity: requirement.requiredQuantity,
        allocatedQuantity: Math.round(allocatedQuantity * 10000) / 10000,
        remainingQuantity:
          Math.round(Math.max(0, requirement.requiredQuantity - allocatedQuantity) * 10000) /
          10000,
        varianceQuantity:
          Math.round((allocatedQuantity - requirement.requiredQuantity) * 10000) / 10000,
      };
    });
}

export async function addFactoryMaterialIssueDraft(input: {
  workOrder: FactoryWorkOrder;
  bomLine: FactoryBomLine;
  existingIssues: FactoryMaterialIssue[];
  quantity: number;
  availableStock: number;
  unitCostSnapshot: number;
  note: string;
  createdBy: string;
}) {
  if (["Completed", "Cancelled"].includes(input.workOrder.status)) {
    throw new Error("Materials cannot be allocated to a closed Work Order.");
  }
  const quantity = Math.round(Math.max(0, Number(input.quantity) || 0) * 10000) / 10000;
  if (quantity <= 0) throw new Error("Material issue quantity must be greater than zero.");
  if (quantity > input.availableStock) {
    throw new Error("Material issue draft exceeds currently available raw stock.");
  }
  const plan = getFactoryMaterialPlan({
    workOrder: input.workOrder,
    bomLines: [input.bomLine],
    materialIssues: input.existingIssues,
  })[0];
  if (plan && quantity > plan.remainingQuantity && !input.note.trim()) {
    throw new Error("Explain the material variance when allocation exceeds the BOM plan.");
  }
  const unitCostSnapshot =
    Math.round(Math.max(0, Number(input.unitCostSnapshot) || 0) * 10000) / 10000;
  const issue: FactoryMaterialIssue = {
    id: createFactoryId("FMAT"),
    workOrderId: input.workOrder.id,
    materialId: input.bomLine.materialId,
    materialName: input.bomLine.materialName,
    unit: input.bomLine.unit,
    quantity,
    unitCostSnapshot,
    totalCost: Math.round(quantity * unitCostSnapshot * 100) / 100,
    status: "Draft",
    postedBy: "",
    postedAt: "",
    returnedQuantity: 0,
    consumedQuantity: 0,
    wastageQuantity: 0,
    finalizedBy: "",
    finalizedAt: "",
    note: input.note.trim(),
    createdBy: input.createdBy.trim(),
    createdAt: new Date().toISOString(),
  };

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      data.materialIssues.unshift(issue);
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return issue;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryMaterialIssueRow>(
        "factory",
        `INSERT INTO factory_material_issues (
          id, work_order_id, material_id, material_name, unit, quantity,
          unit_cost_snapshot, total_cost, status, note, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', $9, $10)
        RETURNING id, work_order_id, material_id, material_name, unit, quantity,
          unit_cost_snapshot, total_cost, status, posted_by, posted_at, returned_quantity,
          consumed_quantity, wastage_quantity, finalized_by, finalized_at,
          note, created_by, created_at`,
        [
          issue.id,
          issue.workOrderId,
          issue.materialId,
          issue.materialName,
          issue.unit,
          issue.quantity,
          issue.unitCostSnapshot,
          issue.totalCost,
          issue.note,
          issue.createdBy,
        ],
      );
      const row = rows[0];
      return {
        ...issue,
        id: row.id,
        createdAt:
          row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      };
    },
  });
}

export async function postFactoryMaterialIssue(input: {
  issue: FactoryMaterialIssue;
  postedBy: string;
}) {
  if (input.issue.status !== "Draft") throw new Error("Only a Draft material issue can be posted.");

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const operations = await import("@/lib/operations");
      const operationData = await operations.getOperationsData();
      const material = operationData.rawMaterials.find(
        (row) => row.id === input.issue.materialId,
      );
      if (!material) throw new Error("Raw material was not found.");
      const available = material.openingStock + material.received - material.used;
      if (input.issue.quantity > available) throw new Error("Not enough raw material stock.");
      await operations.updateRawMaterial(material.id, {
        ...material,
        used: material.used + input.issue.quantity,
      });
      const data = await readLocalFactoryData();
      const issue = data.materialIssues.find((row) => row.id === input.issue.id);
      if (!issue || issue.status !== "Draft") throw new Error("Draft material issue was not found.");
      issue.status = "Posted";
      issue.postedBy = input.postedBy.trim();
      issue.postedAt = new Date().toISOString();
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return issue;
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        const issues = await db.query<FactoryMaterialIssueRow>(
          `SELECT id, work_order_id, material_id, material_name, unit, quantity,
            unit_cost_snapshot, total_cost, status, posted_by, posted_at, returned_quantity,
            consumed_quantity, wastage_quantity, finalized_by, finalized_at,
            note, created_by, created_at
           FROM factory_material_issues WHERE id = $1 FOR UPDATE`,
          [input.issue.id],
        );
        const issue = issues[0];
        if (!issue || issue.status !== "Draft") {
          throw new Error("Draft material issue was not found or already posted.");
        }
        const materials = await db.query<{
          id: string;
          opening_stock: number | string;
          received: number | string;
          used: number | string;
        }>(
          `SELECT id, opening_stock, received, used
           FROM raw_materials WHERE id = $1 FOR UPDATE`,
          [issue.material_id],
        );
        const material = materials[0];
        if (!material) throw new Error("Raw material was not found.");
        const available =
          Number(material.opening_stock) + Number(material.received) - Number(material.used);
        if (Number(issue.quantity) > available) throw new Error("Not enough raw material stock.");
        await db.query(
          "UPDATE raw_materials SET used = used + $2 WHERE id = $1",
          [issue.material_id, Number(issue.quantity)],
        );
        await db.query(
          `UPDATE factory_material_issues
           SET status = 'Posted', posted_by = $2, posted_at = now(), updated_at = now()
           WHERE id = $1`,
          [issue.id, input.postedBy.trim()],
        );
        return {
          ...input.issue,
          status: "Posted" as const,
          postedBy: input.postedBy.trim(),
          postedAt: new Date().toISOString(),
        };
      }),
  });
}

export async function returnFactoryMaterialIssue(input: {
  issue: FactoryMaterialIssue;
  quantity: number;
  note: string;
}) {
  if (input.issue.status !== "Posted" || input.issue.finalizedAt) {
    throw new Error("Only an unfinalized Posted issue can receive a material return.");
  }
  const quantity = Math.round(Math.max(0, Number(input.quantity) || 0) * 10000) / 10000;
  const returnable =
    input.issue.quantity -
    input.issue.returnedQuantity -
    input.issue.consumedQuantity -
    input.issue.wastageQuantity;
  if (quantity <= 0 || quantity > returnable) {
    throw new Error("Return quantity exceeds the unclassified issued quantity.");
  }
  if (!input.note.trim()) throw new Error("Material return reason is required.");

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const operations = await import("@/lib/operations");
      const operationData = await operations.getOperationsData();
      const material = operationData.rawMaterials.find(
        (row) => row.id === input.issue.materialId,
      );
      if (!material || material.used < quantity) throw new Error("Raw material usage cannot be reversed.");
      await operations.updateRawMaterial(material.id, {
        ...material,
        used: material.used - quantity,
      });
      const data = await readLocalFactoryData();
      const issue = data.materialIssues.find((row) => row.id === input.issue.id);
      if (!issue) throw new Error("Posted material issue was not found.");
      issue.returnedQuantity += quantity;
      issue.totalCost =
        Math.round((issue.quantity - issue.returnedQuantity) * issue.unitCostSnapshot * 100) / 100;
      issue.note = [issue.note, input.note.trim()].filter(Boolean).join(" | ");
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return issue;
    },
    postgres: () =>
      transactionPostgres("factory", async (db) => {
        const issues = await db.query<FactoryMaterialIssueRow>(
          `SELECT id, work_order_id, material_id, material_name, unit, quantity,
            unit_cost_snapshot, total_cost, status, posted_by, posted_at, returned_quantity,
            consumed_quantity, wastage_quantity, finalized_by, finalized_at,
            note, created_by, created_at
           FROM factory_material_issues WHERE id = $1 FOR UPDATE`,
          [input.issue.id],
        );
        const issue = issues[0];
        if (!issue || issue.status !== "Posted" || issue.finalized_at) {
          throw new Error("Posted material issue was not found or is already finalized.");
        }
        const liveReturnable =
          Number(issue.quantity) -
          Number(issue.returned_quantity) -
          Number(issue.consumed_quantity) -
          Number(issue.wastage_quantity);
        if (quantity > liveReturnable) {
          throw new Error("Return quantity exceeds the remaining issued quantity.");
        }
        const materials = await db.query<{ used: number | string }>(
          "SELECT used FROM raw_materials WHERE id = $1 FOR UPDATE",
          [issue.material_id],
        );
        if (!materials[0] || Number(materials[0].used) < quantity) {
          throw new Error("Raw material usage cannot be reversed.");
        }
        await db.query(
          "UPDATE raw_materials SET used = used - $2 WHERE id = $1",
          [issue.material_id, quantity],
        );
        await db.query(
          `UPDATE factory_material_issues
           SET returned_quantity = returned_quantity + $2,
             total_cost = ROUND((quantity - returned_quantity - $2) * unit_cost_snapshot, 2),
             note = CASE WHEN note = '' THEN $3 ELSE note || ' | ' || $3 END,
             updated_at = now()
           WHERE id = $1`,
          [issue.id, quantity, input.note.trim()],
        );
        return {
          ...input.issue,
          returnedQuantity: Number(issue.returned_quantity) + quantity,
          totalCost:
            Math.round(
              (Number(issue.quantity) - Number(issue.returned_quantity) - quantity) *
                Number(issue.unit_cost_snapshot) *
                100,
            ) / 100,
        };
      }),
  });
}

export async function finalizeFactoryMaterialIssue(input: {
  issue: FactoryMaterialIssue;
  consumedQuantity: number;
  wastageQuantity: number;
  note: string;
  finalizedBy: string;
}) {
  if (input.issue.status !== "Posted" || input.issue.finalizedAt) {
    throw new Error("Only an unfinalized Posted issue can be finalized.");
  }
  const consumedQuantity =
    Math.round(Math.max(0, Number(input.consumedQuantity) || 0) * 10000) / 10000;
  const wastageQuantity =
    Math.round(Math.max(0, Number(input.wastageQuantity) || 0) * 10000) / 10000;
  const unreturned = input.issue.quantity - input.issue.returnedQuantity;
  if (Math.abs(consumedQuantity + wastageQuantity - unreturned) > 0.0001) {
    throw new Error("Consumed plus wastage must equal issued quantity after returns.");
  }
  if (wastageQuantity > 0 && !input.note.trim()) {
    throw new Error("Wastage reason is required.");
  }
  const finalizedAt = new Date().toISOString();

  return runWithDataBackend({
    storeName: "factory",
    localJson: async () => {
      const data = await readLocalFactoryData();
      const issue = data.materialIssues.find((row) => row.id === input.issue.id);
      if (!issue || issue.finalizedAt) throw new Error("Material issue was already finalized.");
      issue.consumedQuantity = consumedQuantity;
      issue.wastageQuantity = wastageQuantity;
      issue.finalizedBy = input.finalizedBy.trim();
      issue.finalizedAt = finalizedAt;
      issue.note = [issue.note, input.note.trim()].filter(Boolean).join(" | ");
      await writeFileAtomic(factoryDataPath, JSON.stringify(data, null, 2));
      return issue;
    },
    postgres: async () => {
      const rows = await queryPostgres<FactoryMaterialIssueRow>(
        "factory",
        `UPDATE factory_material_issues
         SET consumed_quantity = $2, wastage_quantity = $3, finalized_by = $4,
           finalized_at = $5,
           note = CASE WHEN $6 = '' THEN note WHEN note = '' THEN $6 ELSE note || ' | ' || $6 END,
           updated_at = now()
         WHERE id = $1 AND status = 'Posted' AND finalized_at IS NULL
           AND ABS(($2 + $3) - (quantity - returned_quantity)) < 0.0001
         RETURNING id, work_order_id, material_id, material_name, unit, quantity,
           unit_cost_snapshot, total_cost, status, posted_by, posted_at, returned_quantity,
           consumed_quantity, wastage_quantity, finalized_by, finalized_at,
           note, created_by, created_at`,
        [
          input.issue.id,
          consumedQuantity,
          wastageQuantity,
          input.finalizedBy.trim(),
          finalizedAt,
          input.note.trim(),
        ],
      );
      if (!rows[0]) throw new Error("Material issue changed or was already finalized.");
      return {
        ...input.issue,
        consumedQuantity,
        wastageQuantity,
        finalizedBy: input.finalizedBy.trim(),
        finalizedAt,
      };
    },
  });
}

export const factoryRolloutPhases = [
  { number: 1, name: "Foundation", scope: "Worker ID linkage, production item master, stages, roles and permissions", status: "In progress" },
  { number: 2, name: "Planning", scope: "Work orders, lots, BOM, colour and mixed-size worksheets", status: "Pending" },
  { number: 3, name: "Factory execution", scope: "Partial entries, handovers, QC, reject/rework and offline queue", status: "Pending" },
  { number: 4, name: "Money and stock", scope: "Rate snapshots, verified wages, actual costing and stock posting", status: "Pending" },
  { number: 5, name: "Control", scope: "Lot QR, dashboards, reports, audit history and CCTV references", status: "Pending" },
] as const;

function employeeNameKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export type FactoryFoundationAudit = {
  employeeCount: number;
  activeEmployeeCount: number;
  productionBatchCount: number;
  legacyTaskCount: number;
  linkedLegacyTaskCount: number;
  unlinkedLegacyTaskCount: number;
  ambiguousLegacyTaskCount: number;
  legacyWorkerNames: string[];
  unlinkedWorkerNames: string[];
  ambiguousWorkerNames: string[];
};

export function auditFactoryFoundation(input: {
  employees: Employee[];
  productionBatches: ProductionBatch[];
  workerTasks: WorkerTask[];
}): FactoryFoundationAudit {
  const employeesByName = new Map<string, Employee[]>();
  for (const employee of input.employees) {
    const key = employeeNameKey(employee.name);
    employeesByName.set(key, [...(employeesByName.get(key) ?? []), employee]);
  }

  const legacyWorkerNames = [...new Set(input.workerTasks.map((task) => task.workerName))].sort(
    (left, right) => left.localeCompare(right),
  );
  const unlinkedWorkerNames = legacyWorkerNames.filter(
    (name) => !employeesByName.has(employeeNameKey(name)),
  );
  const ambiguousWorkerNames = legacyWorkerNames.filter(
    (name) => (employeesByName.get(employeeNameKey(name))?.length ?? 0) > 1,
  );
  const unlinked = new Set(unlinkedWorkerNames.map(employeeNameKey));
  const ambiguous = new Set(ambiguousWorkerNames.map(employeeNameKey));

  return {
    employeeCount: input.employees.length,
    activeEmployeeCount: input.employees.filter((employee) => employee.status === "Active").length,
    productionBatchCount: input.productionBatches.length,
    legacyTaskCount: input.workerTasks.length,
    linkedLegacyTaskCount: input.workerTasks.filter((task) => {
      const key = employeeNameKey(task.workerName);
      return !unlinked.has(key) && !ambiguous.has(key);
    }).length,
    unlinkedLegacyTaskCount: input.workerTasks.filter((task) =>
      unlinked.has(employeeNameKey(task.workerName)),
    ).length,
    ambiguousLegacyTaskCount: input.workerTasks.filter((task) =>
      ambiguous.has(employeeNameKey(task.workerName)),
    ).length,
    legacyWorkerNames,
    unlinkedWorkerNames,
    ambiguousWorkerNames,
  };
}
