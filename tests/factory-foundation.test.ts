import { describe, expect, it } from "vitest";
import {
  auditFactoryFoundation,
  calculateBomRequirement,
  factoryStages,
  normalizeFactoryItem,
  normalizeProductionSizeEntries,
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
});
