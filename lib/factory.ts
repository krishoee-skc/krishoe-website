import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "@/lib/atomic-json";
import { runWithDataBackend } from "@/lib/data-backend";
import type { Employee } from "@/lib/hr";
import type { ProductionBatch, WorkerTask } from "@/lib/operations";
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
};

export type FactoryProductionEntryStatus = "Submitted" | "Verified" | "Rejected";

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
        wage_rate_snapshot, calculated_wage, status, remarks, entered_by, created_at
       FROM factory_production_entries ORDER BY created_at DESC`,
    ),
    queryPostgres<FactoryProductionEntrySizeRow>(
      "factory",
      `SELECT id, production_entry_id, size, received_pairs, good_pairs,
        reject_pairs, rework_pairs
       FROM factory_production_entry_sizes ORDER BY size ASC`,
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
    const alreadyProcessed = input.existingEntrySizes
      .filter(
        (entry) =>
          assignmentEntryIds.has(entry.productionEntryId) && entry.size === row.size,
      )
      .reduce((sum, entry) => sum + entry.receivedPairs, 0);
    if (row.receivedPairs > planned - alreadyProcessed) {
      throw new Error(`Size ${row.size} exceeds its remaining planned quantity.`);
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
