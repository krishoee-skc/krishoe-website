import { describe, expect, it } from "vitest";
import {
  auditFactoryFoundation,
  calculateBomRequirement,
  factoryStages,
  normalizeFactoryItem,
  normalizeProductionSizeEntries,
  normalizeFactoryHandoverSizes,
  getFactoryPackingReadiness,
  getFactoryMaterialPlan,
  normalizeWorkOrderSizes,
  validateFactoryRelease,
} from "@/lib/factory";
import type { Employee } from "@/lib/hr";
import type { ProductionBatch, WorkerTask } from "@/lib/operations";

function employee(id: string, name: string, status: Employee["status"] = "Active"): Employee {
  return {
    id,
    createdAt: "2026-07-25T00:00:00.000Z",
    name,
    phone: "",
    role: "Worker",
    department: "Stitching",
    employmentType: "Full Time",
    salaryType: "Piece Rate",
    baseSalary: 0,
    dailyWage: 0,
    pieceRate: 10,
    status,
    joinedAt: "2026-07-01",
    fingerprintId: "",
    note: "",
  };
}

function task(id: string, workerName: string): WorkerTask {
  return {
    id,
    workerName,
    station: "Stitching",
    batchId: "batch-1",
    design: "Test item",
    targetPairs: 60,
    completedPairs: 30,
    status: "In Progress",
    cameraZone: "",
  };
}

describe("Factory ERP foundation", () => {
  it("keeps fiber stitching between the two bottom stages", () => {
    expect(factoryStages.map((stage) => stage.code)).toEqual([
      "upper",
      "bottom-preparation",
      "fiber-stitching",
      "bottom-lasting",
      "finishing",
      "packing",
    ]);
  });

  it("audits legacy name linkage without mutating records", () => {
    const employees = [
      employee("emp-1", "Ram BK"),
      employee("emp-2", "Mina Rai"),
      employee("emp-3", "Mina Rai", "Inactive"),
    ];
    const workerTasks = [
      task("task-1", " Ram  BK "),
      task("task-2", "Unknown Worker"),
      task("task-3", "Mina Rai"),
    ];
    const productionBatches = [{ id: "batch-1" }] as ProductionBatch[];

    const result = auditFactoryFoundation({ employees, workerTasks, productionBatches });

    expect(result.productionBatchCount).toBe(1);
    expect(result.linkedLegacyTaskCount).toBe(1);
    expect(result.unlinkedLegacyTaskCount).toBe(1);
    expect(result.ambiguousLegacyTaskCount).toBe(1);
    expect(result.unlinkedWorkerNames).toEqual(["Unknown Worker"]);
    expect(result.ambiguousWorkerNames).toEqual(["Mina Rai"]);
    expect(workerTasks[0].workerName).toBe(" Ram  BK ");
  });

  it("normalizes item master values and preserves the configured stage order", () => {
    const item = normalizeFactoryItem({
      id: "item-1",
      code: "  lh-01 ",
      nepaliName: " लेडिज हिल ",
      englishName: " Ladies Heel ",
      category: " Heel ",
      productId: "",
      colors: ["Black", " Black ", "Maroon"],
      sizes: ["36", "37", "36"],
      stageCodes: ["upper", "fiber-stitching", "bottom-lasting"],
      standardMinutesPerPair: 12.345,
      status: "Active",
    });

    expect(item.code).toBe("LH-01");
    expect(item.colors).toEqual(["Black", "Maroon"]);
    expect(item.sizes).toEqual(["36", "37"]);
    expect(item.stageCodes).toEqual(["upper", "fiber-stitching", "bottom-lasting"]);
    expect(item.standardMinutesPerPair).toBe(12.35);
  });

  it("calculates BOM requirements with planned wastage", () => {
    expect(
      calculateBomRequirement(
        {
          id: "bom-1",
          itemId: "item-1",
          materialId: "rm-rexine",
          materialName: "Rexine",
          unit: "meter",
          quantityPerPair: 0.25,
          wastagePercent: 8,
        },
        60,
      ),
    ).toEqual({
      baseQuantity: 15,
      wastageQuantity: 1.2,
      requiredQuantity: 16.2,
    });
  });

  it("normalizes mixed-size plans and rejects zero rows from the total", () => {
    expect(
      normalizeWorkOrderSizes([
        { size: "36", plannedPairs: 10 },
        { size: " 36 ", plannedPairs: 5 },
        { size: "37", plannedPairs: 0 },
        { size: "38", plannedPairs: 20.4 },
      ]),
    ).toEqual([
      { size: "36", plannedPairs: 15 },
      { size: "38", plannedPairs: 20 },
    ]);
  });

  it("blocks release until every configured stage has a worker", () => {
    const item = normalizeFactoryItem({
      id: "item-1",
      code: "LH-01",
      nepaliName: "",
      englishName: "Ladies Heel",
      category: "Heel",
      productId: "",
      colors: ["Black"],
      sizes: ["36"],
      stageCodes: ["upper", "fiber-stitching"],
      standardMinutesPerPair: 0,
      status: "Active",
    });
    expect(() =>
      validateFactoryRelease({
        item,
        bomLines: [{
          id: "bom-1",
          itemId: item.id,
          materialId: "rm-1",
          materialName: "Rexine",
          unit: "meter",
          quantityPerPair: 0.2,
          wastagePercent: 5,
        }],
        assignments: [{
          stageCode: "upper",
          workerId: "emp-1",
          workerName: "Ram",
          ratePerGoodPairSnapshot: 10,
          cameraZone: "",
        }],
      }),
    ).toThrow("fiber-stitching");
  });

  it("normalizes a partial production entry and derives received pairs", () => {
    expect(
      normalizeProductionSizeEntries([
        { size: "36", goodPairs: 8, rejectPairs: 1, reworkPairs: 1 },
        { size: "37", goodPairs: 0, rejectPairs: 0, reworkPairs: 0 },
      ]),
    ).toEqual([
      {
        size: "36",
        goodPairs: 8,
        rejectPairs: 1,
        reworkPairs: 1,
        receivedPairs: 10,
      },
    ]);
  });

  it("calculates handover discrepancy and blocks receiving more than sent", () => {
    expect(
      normalizeFactoryHandoverSizes([
        { size: "36", sentPairs: 10, receivedPairs: 9 },
        { size: "37", sentPairs: 0, receivedPairs: 0 },
      ]),
    ).toEqual([
      { size: "36", sentPairs: 10, receivedPairs: 9, discrepancyPairs: 1 },
    ]);
    expect(() =>
      normalizeFactoryHandoverSizes([
        { size: "36", sentPairs: 8, receivedPairs: 9 },
      ]),
    ).toThrow("cannot exceed sent");
  });

  it("marks packing ready only when every planned size has verified good pairs", () => {
    const workOrder = {
      id: "wo-1",
      workOrderNumber: "WO-1",
      lotNumber: "LOT-1",
      itemId: "item-1",
      itemCode: "LH-01",
      itemName: "Ladies Heel",
      color: "Black",
      createdDate: "2026-07-26",
      dueDate: "2026-07-27",
      priority: "Normal" as const,
      currentStageCode: "packing" as const,
      status: "In Progress" as const,
      totalPairs: 10,
      remarks: "",
      createdBy: "Owner",
    };
    const packingAssignment = {
      id: "assignment-pack",
      workOrderId: workOrder.id,
      stageCode: "packing" as const,
      sequence: 1,
      workerId: "emp-1",
      workerName: "Mina",
      targetPairs: 10,
      status: "In Progress" as const,
      ratePerGoodPairSnapshot: 5,
      cameraZone: "",
    };
    const entry = {
      id: "entry-1",
      workOrderId: workOrder.id,
      assignmentId: packingAssignment.id,
      workerId: "emp-1",
      workerName: "Mina",
      stageCode: "packing" as const,
      entryDate: "2026-07-26",
      receivedPairs: 10,
      goodPairs: 10,
      rejectPairs: 0,
      reworkPairs: 0,
      wageRateSnapshot: 5,
      calculatedWage: 50,
      status: "Verified" as const,
      remarks: "",
      enteredBy: "Owner",
      createdAt: "2026-07-26T00:00:00.000Z",
      rejectReason: "" as const,
      responsibleWorkerId: "",
      reworkPossible: false,
      verificationNote: "",
      verifiedBy: "Owner",
      verifiedAt: "2026-07-26T00:01:00.000Z",
    };

    expect(
      getFactoryPackingReadiness(
        {
          workOrderSizes: [
            { id: "size-36", workOrderId: workOrder.id, size: "36", plannedPairs: 10 },
          ],
          stageAssignments: [packingAssignment],
          productionEntries: [entry],
          productionEntrySizes: [
            {
              id: "entry-size-36",
              productionEntryId: entry.id,
              size: "36",
              receivedPairs: 10,
              goodPairs: 10,
              rejectPairs: 0,
              reworkPairs: 0,
            },
          ],
          packingApprovals: [],
        },
        workOrder,
      ).ready,
    ).toBe(true);
  });

  it("tracks BOM allocation and material variance per Work Order", () => {
    const workOrder = {
      id: "wo-material",
      workOrderNumber: "WO-MAT",
      lotNumber: "LOT-MAT",
      itemId: "item-1",
      itemCode: "LH-01",
      itemName: "Ladies Heel",
      color: "Black",
      createdDate: "2026-07-26",
      dueDate: "2026-07-27",
      priority: "Normal" as const,
      currentStageCode: "upper" as const,
      status: "Draft" as const,
      totalPairs: 10,
      remarks: "",
      createdBy: "Owner",
    };
    const plan = getFactoryMaterialPlan({
      workOrder,
      bomLines: [
        {
          id: "bom-rexine",
          itemId: "item-1",
          materialId: "rm-rexine",
          materialName: "Rexine",
          unit: "meter",
          quantityPerPair: 0.2,
          wastagePercent: 10,
        },
      ],
      materialIssues: [
        {
          id: "issue-1",
          workOrderId: workOrder.id,
          materialId: "rm-rexine",
          materialName: "Rexine",
          unit: "meter",
          quantity: 1.2,
          unitCostSnapshot: 100,
          totalCost: 120,
          status: "Draft",
          note: "",
          createdBy: "Owner",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
      ],
    });

    expect(plan[0].plannedQuantity).toBe(2.2);
    expect(plan[0].allocatedQuantity).toBe(1.2);
    expect(plan[0].remainingQuantity).toBe(1);
    expect(plan[0].varianceQuantity).toBe(-1);
  });
});
