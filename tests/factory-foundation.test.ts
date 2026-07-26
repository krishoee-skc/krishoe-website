import { describe, expect, it } from "vitest";
import {
  auditFactoryFoundation,
  calculateBomRequirement,
  factoryStages,
  factoryWorkOrderTracePath,
  factoryWorkOrderTraceUrl,
  factoryWorkOrderWorksheetPath,
  normalizeFactoryItem,
  normalizeProductionSizeEntries,
  normalizeFactoryHandoverSizes,
  normalizeFactoryCctvReference,
  normalizeFactoryAssignmentReassignment,
  getFactoryPackingReadiness,
  getFactoryMaterialPlan,
  getFactoryDashboard,
  getFactoryPerformanceReport,
  getFactoryWageCandidates,
  getFactoryWorkOrderCosting,
  getFactoryWorkOrderCancellationBlockers,
  getFactoryStagePauseTransition,
  filterFactoryWorkOrders,
  getFactoryStationAssignments,
  finalizeFactoryMaterialIssue,
  returnFactoryMaterialIssue,
  normalizeWorkOrderSizes,
  validateFactoryRelease,
  validateFactoryStockPosting,
  type FactoryData,
  type FactoryMaterialIssue,
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

  it("builds a stable printable Work Order worksheet path", () => {
    expect(factoryWorkOrderWorksheetPath("FWO 1")).toBe(
      "/admin/factory/work-orders/FWO%201/worksheet",
    );
  });

  it("reassigns only future stage work with a clean rate snapshot", () => {
    const assignment = {
      id: "assign-1",
      workOrderId: "wo-1",
      stageCode: "upper" as const,
      sequence: 1,
      workerId: "emp-old",
      workerName: "Old Worker",
      targetPairs: 60,
      status: "In Progress" as const,
      ratePerGoodPairSnapshot: 10,
      cameraZone: "Upper A",
    };
    expect(
      normalizeFactoryAssignmentReassignment({
        assignment,
        workerId: " emp-new ",
        workerName: " New Worker ",
        ratePerGoodPair: 12.345,
        cameraZone: " Upper B ",
      }),
    ).toEqual({
      workerId: "emp-new",
      workerName: "New Worker",
      ratePerGoodPairSnapshot: 12.35,
      cameraZone: "Upper B",
    });
    expect(() =>
      normalizeFactoryAssignmentReassignment({
        assignment: { ...assignment, status: "Completed" },
        workerId: "emp-new",
        workerName: "New Worker",
        ratePerGoodPair: 12,
        cameraZone: "",
      }),
    ).toThrow("completed stage");
  });

  it("blocks unsafe Work Order cancellation after production or material posting", () => {
    const order = {
      id: "wo-cancel",
      status: "Released",
    } as FactoryData["workOrders"][number];
    expect(
      getFactoryWorkOrderCancellationBlockers(
        { productionEntries: [], materialIssues: [], packingApprovals: [] },
        order,
      ),
    ).toEqual([]);
    expect(
      getFactoryWorkOrderCancellationBlockers(
        {
          productionEntries: [{ workOrderId: order.id }] as FactoryData["productionEntries"],
          materialIssues: [
            { workOrderId: order.id, status: "Posted" },
          ] as FactoryData["materialIssues"],
          packingApprovals: [],
        },
        order,
      ),
    ).toEqual([
      "Production entries already exist.",
      "Posted raw material must be reconciled before cancellation.",
    ]);
  });

  it("pauses the current stage with a reason and resumes to the correct state", () => {
    const workOrder = {
      id: "wo-pause",
      status: "In Progress",
      currentStageCode: "upper",
    } as FactoryData["workOrders"][number];
    const assignment = {
      id: "assign-pause",
      workOrderId: workOrder.id,
      stageCode: "upper",
      status: "In Progress",
    } as FactoryData["stageAssignments"][number];
    const paused = getFactoryStagePauseTransition({
      assignment,
      workOrder,
      productionEntries: [],
      action: "pause",
      reason: " Material shortage ",
      changedBy: "Owner",
    });
    expect(paused.status).toBe("Paused");
    expect(paused.pauseReason).toBe("Material shortage");

    expect(
      getFactoryStagePauseTransition({
        assignment: { ...assignment, status: "Paused" },
        workOrder,
        productionEntries: [
          {
            assignmentId: assignment.id,
            status: "Verified",
          },
        ] as FactoryData["productionEntries"],
        action: "resume",
        reason: "",
        changedBy: "Owner",
      }).status,
    ).toBe("In Progress");
  });

  it("filters the Work Order command list by search, status and active stage", () => {
    const workOrders = [
      {
        id: "wo-1",
        workOrderNumber: "WO-1001",
        lotNumber: "LOT-BLACK",
        itemCode: "LH-01",
        itemName: "Ladies Heel",
        color: "Black",
        status: "In Progress",
        priority: "Urgent",
        createdBy: "Owner",
      },
      {
        id: "wo-2",
        workOrderNumber: "WO-1002",
        lotNumber: "LOT-RED",
        itemCode: "KS-01",
        itemName: "Kids Sandal",
        color: "Red",
        status: "Draft",
        priority: "Normal",
        createdBy: "Owner",
      },
    ] as FactoryData["workOrders"];
    const stageAssignments = [
      {
        workOrderId: "wo-1",
        stageCode: "fiber-stitching",
        status: "In Progress",
      },
    ] as FactoryData["stageAssignments"];
    expect(
      filterFactoryWorkOrders(
        { workOrders, stageAssignments },
        {
          query: "ladies",
          status: "In Progress",
          priority: "Urgent",
          stageCode: "fiber-stitching",
        },
      ).map((order) => order.id),
    ).toEqual(["wo-1"]);
    expect(
      filterFactoryWorkOrders(
        { workOrders, stageAssignments },
        { query: "lot-red" },
      ).map((order) => order.id),
    ).toEqual(["wo-2"]);
  });

  it("shows only the current active stage in Station Mode", () => {
    const workOrders = [
      {
        id: "wo-station",
        workOrderNumber: "WO-STATION",
        lotNumber: "LOT-STATION",
        itemCode: "LH",
        itemName: "Ladies Heel",
        color: "Black",
        dueDate: "2026-07-27",
        status: "In Progress",
        currentStageCode: "fiber-stitching",
      },
    ] as FactoryData["workOrders"];
    const stageAssignments = [
      {
        id: "waiting",
        workOrderId: "wo-station",
        stageCode: "bottom-lasting",
        workerId: "emp-2",
        workerName: "Shyam",
        status: "Waiting",
      },
      {
        id: "active",
        workOrderId: "wo-station",
        stageCode: "fiber-stitching",
        workerId: "emp-1",
        workerName: "Ram",
        status: "In Progress",
      },
    ] as FactoryData["stageAssignments"];
    expect(
      getFactoryStationAssignments(
        { workOrders, stageAssignments },
        { workerId: "emp-1", stageCode: "fiber-stitching" },
      ).map((row) => row.assignment.id),
    ).toEqual(["active"]);
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
          postedBy: "",
          postedAt: "",
          returnedQuantity: 0,
          consumedQuantity: 0,
          wastageQuantity: 0,
          finalizedBy: "",
          finalizedAt: "",
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

describe("factory material issue safeguards", () => {
  const postedIssue: FactoryMaterialIssue = {
    id: "issue-posted",
    workOrderId: "wo-1",
    materialId: "rm-1",
    materialName: "Rexine",
    unit: "meter",
    quantity: 10,
    unitCostSnapshot: 100,
    totalCost: 1000,
    status: "Posted",
    postedBy: "Owner",
    postedAt: "2026-07-26T00:00:00.000Z",
    returnedQuantity: 2,
    consumedQuantity: 0,
    wastageQuantity: 0,
    finalizedBy: "",
    finalizedAt: "",
    note: "",
    createdBy: "Owner",
    createdAt: "2026-07-26T00:00:00.000Z",
  };

  it("rejects a return larger than the unclassified balance", async () => {
    await expect(
      returnFactoryMaterialIssue({ issue: postedIssue, quantity: 9, note: "Unused" }),
    ).rejects.toThrow("exceeds");
  });

  it("requires consumed plus wastage to reconcile after returns", async () => {
    await expect(
      finalizeFactoryMaterialIssue({
        issue: postedIssue,
        consumedQuantity: 7,
        wastageQuantity: 0,
        note: "",
        finalizedBy: "Owner",
      }),
    ).rejects.toThrow("must equal");
  });
});

describe("finished stock posting safeguards", () => {
  it("accepts one reconciled packing approval with finalized materials", () => {
    const workOrder = {
      id: "wo-stock",
      workOrderNumber: "WO-STOCK",
      lotNumber: "LOT-STOCK",
      itemId: "item-1",
      itemCode: "LH-01",
      itemName: "Ladies Heel",
      color: "Black",
      createdDate: "2026-07-26",
      dueDate: "2026-07-27",
      priority: "Normal" as const,
      currentStageCode: "packing" as const,
      status: "Ready for Stock" as const,
      totalPairs: 10,
      remarks: "",
      createdBy: "Owner",
    };
    const data = {
      workOrderSizes: [
        { id: "s36", workOrderId: workOrder.id, size: "36", plannedPairs: 4 },
        { id: "s37", workOrderId: workOrder.id, size: "37", plannedPairs: 6 },
      ],
      packingApprovals: [
        {
          id: "pack-1",
          workOrderId: workOrder.id,
          packingAssignmentId: "assignment-1",
          approvedPairs: 10,
          approvedBy: "Packing",
          stockMovementIds: [],
          stockPostedBy: "",
          stockPostedAt: "",
          note: "",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
      ],
      materialIssues: [
        {
          id: "issue-stock",
          workOrderId: workOrder.id,
          materialId: "rm-1",
          materialName: "Rexine",
          unit: "meter",
          quantity: 8,
          unitCostSnapshot: 100,
          totalCost: 800,
          status: "Posted",
          postedBy: "Owner",
          postedAt: "2026-07-26T00:00:00.000Z",
          returnedQuantity: 0,
          finalizedBy: "Owner",
          finalizedAt: "2026-07-26T01:00:00.000Z",
          consumedQuantity: 8,
          wastageQuantity: 0,
          note: "",
          createdBy: "Owner",
          createdAt: "2026-07-26T00:00:00.000Z",
        },
      ],
    } as unknown as FactoryData;

    expect(validateFactoryStockPosting(data, workOrder).sizes).toHaveLength(2);
    data.packingApprovals[0].stockPostedAt = "2026-07-26T02:00:00.000Z";
    expect(() => validateFactoryStockPosting(data, workOrder)).toThrow(
      "already posted",
    );
  });
});

describe("factory lot trace links", () => {
  it("builds an encoded Owner-only trace path and absolute QR URL", () => {
    expect(factoryWorkOrderTracePath("WO lot/1")).toBe(
      "/admin/factory/work-orders/WO%20lot%2F1",
    );
    expect(
      factoryWorkOrderTraceUrl(
        "https://krishoe-website.vercel.app/api/factory/qr",
        "WO-1",
      ),
    ).toBe("https://krishoe-website.vercel.app/admin/factory/work-orders/WO-1");
  });
});

describe("factory command dashboard", () => {
  it("uses verified daily output and assignment balances for live KPIs", () => {
    const data = {
      workOrders: [
        {
          id: "wo-dashboard",
          workOrderNumber: "WO-DASH",
          dueDate: "2026-07-25",
          status: "In Progress",
        },
        {
          id: "wo-ready",
          workOrderNumber: "WO-READY",
          dueDate: "2026-07-30",
          status: "Ready for Stock",
          totalPairs: 12,
        },
      ],
      stageAssignments: [
        {
          id: "assignment-1",
          workOrderId: "wo-dashboard",
          stageCode: "upper",
          workerId: "worker-1",
          workerName: "Ram",
          targetPairs: 10,
          status: "In Progress",
        },
        {
          id: "assignment-2",
          workOrderId: "wo-ready",
          stageCode: "packing",
          workerId: "worker-2",
          workerName: "Sita",
          targetPairs: 12,
          status: "Ready",
        },
      ],
      productionEntries: [
        {
          id: "entry-verified",
          assignmentId: "assignment-1",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 6,
          rejectPairs: 1,
          reworkPairs: 1,
          calculatedWage: 60,
          status: "Verified",
        },
        {
          id: "entry-submitted",
          assignmentId: "assignment-1",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 2,
          rejectPairs: 0,
          reworkPairs: 0,
          calculatedWage: 20,
          status: "Submitted",
        },
      ],
      bomLines: [],
      materialIssues: [],
    } as unknown as FactoryData;

    const dashboard = getFactoryDashboard(data, "2026-07-26");
    expect(dashboard.todayGoodPairs).toBe(6);
    expect(dashboard.todayRejectPairs).toBe(1);
    expect(dashboard.pendingVerificationEntries).toBe(1);
    expect(dashboard.estimatedWagesPending).toBe(20);
    expect(dashboard.overdueWorkOrders).toBe(1);
    expect(dashboard.readyForStockPairs).toBe(12);
    expect(dashboard.workersWithoutEntry).toBe(1);
    expect(dashboard.pausedStages).toEqual([]);
    expect(
      dashboard.stagePending.find((entry) => entry.stageCode === "upper")
        ?.pendingPairs,
    ).toBe(4);
    expect(dashboard.topOutputWorker).toEqual({ workerName: "Ram", pairs: 6 });
    expect(dashboard.highestQualityWorker?.qualityRate).toBe(75);
  });
});

describe("factory period performance report", () => {
  it("groups only verified in-range production by worker, stage, and item", () => {
    const data = {
      workOrders: [
        {
          id: "wo-report",
          itemId: "item-1",
          itemCode: "LH-01",
          itemName: "Ladies Heel",
          status: "Completed",
          createdDate: "2026-07-26",
        },
      ],
      productionEntries: [
        {
          id: "verified-1",
          workOrderId: "wo-report",
          workerId: "worker-1",
          workerName: "Ram",
          stageCode: "upper",
          entryDate: "2026-07-26",
          goodPairs: 8,
          rejectPairs: 1,
          reworkPairs: 1,
          calculatedWage: 80,
          status: "Verified",
        },
        {
          id: "submitted-1",
          workOrderId: "wo-report",
          workerId: "worker-1",
          workerName: "Ram",
          stageCode: "upper",
          entryDate: "2026-07-26",
          goodPairs: 20,
          rejectPairs: 0,
          reworkPairs: 0,
          calculatedWage: 200,
          status: "Submitted",
        },
        {
          id: "outside-1",
          workOrderId: "wo-report",
          workerId: "worker-2",
          workerName: "Sita",
          stageCode: "packing",
          entryDate: "2026-07-20",
          goodPairs: 30,
          rejectPairs: 0,
          reworkPairs: 0,
          calculatedWage: 150,
          status: "Verified",
        },
      ],
    } as unknown as FactoryData;

    const report = getFactoryPerformanceReport(
      data,
      "2026-07-26",
      "2026-07-26",
    );
    expect(report.goodPairs).toBe(8);
    expect(report.verifiedWage).toBe(80);
    expect(report.completedWorkOrders).toBe(1);
    expect(report.workers).toHaveLength(1);
    expect(report.workers[0].qualityRate).toBe(80);
    expect(report.stages[0].label).toBe("Upper");
    expect(report.items[0].label).toContain("Ladies Heel");
  });
});

describe("factory piece-wage settlement candidates", () => {
  it("includes verified wages once and excludes already linked entries", () => {
    const data = {
      productionEntries: [
        {
          id: "entry-wage-1",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 10,
          calculatedWage: 180,
          status: "Verified",
        },
        {
          id: "entry-wage-2",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 5,
          calculatedWage: 90,
          status: "Verified",
        },
        {
          id: "entry-submitted",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 20,
          calculatedWage: 360,
          status: "Submitted",
        },
      ],
      wageSettlementEntries: [
        {
          settlementId: "settlement-old",
          productionEntryId: "entry-wage-1",
          amountSnapshot: 180,
        },
      ],
    } as unknown as FactoryData;

    expect(
      getFactoryWageCandidates(data, "2026-07-26", "2026-07-26"),
    ).toEqual([
      {
        workerId: "worker-1",
        workerName: "Ram",
        entryIds: ["entry-wage-2"],
        goodPairs: 5,
        amount: 90,
      },
    ]);
  });
});

describe("factory Work Order actual costing", () => {
  it("uses BOM plans, issue rate snapshots, verified wages, and packed output", () => {
    const workOrder = {
      id: "wo-cost",
      itemId: "item-cost",
      totalPairs: 10,
    } as FactoryData["workOrders"][number];
    const data = {
      bomLines: [
        {
          id: "bom-1",
          itemId: "item-cost",
          materialId: "rm-1",
          materialName: "Rexine",
          unit: "meter",
          quantityPerPair: 0.2,
          wastagePercent: 10,
        },
      ],
      materialIssues: [
        {
          id: "issue-cost",
          workOrderId: "wo-cost",
          materialId: "rm-1",
          quantity: 2.5,
          unitCostSnapshot: 100,
          totalCost: 240,
          status: "Posted",
          wastageQuantity: 0.2,
        },
      ],
      stageAssignments: [
        {
          id: "upper-cost",
          workOrderId: "wo-cost",
          sequence: 1,
          targetPairs: 10,
          ratePerGoodPairSnapshot: 10,
        },
        {
          id: "packing-cost",
          workOrderId: "wo-cost",
          sequence: 2,
          targetPairs: 10,
          ratePerGoodPairSnapshot: 5,
        },
      ],
      productionEntries: [
        {
          id: "entry-upper",
          workOrderId: "wo-cost",
          assignmentId: "upper-cost",
          status: "Verified",
          calculatedWage: 100,
          rejectPairs: 1,
          reworkPairs: 0,
          goodPairs: 10,
        },
        {
          id: "entry-packing",
          workOrderId: "wo-cost",
          assignmentId: "packing-cost",
          status: "Verified",
          calculatedWage: 50,
          rejectPairs: 0,
          reworkPairs: 1,
          goodPairs: 10,
        },
      ],
      packingApprovals: [{ workOrderId: "wo-cost", approvedPairs: 10 }],
    } as unknown as FactoryData;

    expect(getFactoryWorkOrderCosting(data, workOrder)).toMatchObject({
      plannedMaterialCost: 220,
      actualMaterialCost: 240,
      wastageCost: 20,
      plannedLabourCost: 150,
      actualLabourCost: 150,
      plannedTotalCost: 370,
      actualTotalCost: 390,
      totalVariance: 20,
      outputPairs: 10,
      plannedCostPerPair: 37,
      actualCostPerPair: 39,
      rejectPairs: 1,
      reworkPairs: 1,
      missingMaterialRates: 0,
    });
  });
});

describe("factory CCTV reference safeguards", () => {
  const baseReference = {
    workOrderId: "wo-1",
    stageCode: "upper" as const,
    cameraZone: "Upper Camera 1",
    startedAt: "2026-07-26T10:00:00+05:45",
    endedAt: "2026-07-26T10:15:00+05:45",
    referenceUrl: "https://dvr.example/clip/1",
    incidentType: "Routine verification" as const,
    note: "",
    createdBy: "Owner",
  };

  it("normalizes a safe timestamp/link reference without storing video", () => {
    expect(normalizeFactoryCctvReference(baseReference)).toMatchObject({
      cameraZone: "Upper Camera 1",
      referenceUrl: "https://dvr.example/clip/1",
      startedAt: "2026-07-26T04:15:00.000Z",
      endedAt: "2026-07-26T04:30:00.000Z",
    });
  });

  it("rejects unsafe links, reversed time windows, and incidents without notes", () => {
    expect(() =>
      normalizeFactoryCctvReference({
        ...baseReference,
        referenceUrl: "javascript:alert(1)",
      }),
    ).toThrow("http or https");
    expect(() =>
      normalizeFactoryCctvReference({
        ...baseReference,
        startedAt: baseReference.endedAt,
        endedAt: baseReference.startedAt,
      }),
    ).toThrow("time window");
    expect(() =>
      normalizeFactoryCctvReference({
        ...baseReference,
        incidentType: "Safety incident",
      }),
    ).toThrow("Incident note");
  });
});
