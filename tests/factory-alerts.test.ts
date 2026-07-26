import { describe, expect, it } from "vitest";
import { buildFactoryOperationalAlerts } from "@/lib/notifications";
import type { FactoryData } from "@/lib/factory";

describe("Factory operational alerts", () => {
  it("turns actionable production states into stable deduplicated alerts", () => {
    const factory = {
      workOrders: [
        {
          id: "wo-overdue",
          itemId: "item-1",
          dueDate: "2026-07-20",
          status: "In Progress",
          totalPairs: 10,
        },
        {
          id: "wo-stock",
          itemId: "item-2",
          dueDate: "2026-07-30",
          status: "Ready for Stock",
          totalPairs: 12,
        },
      ],
      stageAssignments: [
        {
          id: "assignment-1",
          workOrderId: "wo-overdue",
          stageCode: "upper",
          workerId: "worker-1",
          targetPairs: 10,
          status: "In Progress",
        },
      ],
      productionEntries: [
        {
          id: "entry-submitted",
          workOrderId: "wo-overdue",
          assignmentId: "assignment-1",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-26",
          goodPairs: 4,
          rejectPairs: 0,
          reworkPairs: 0,
          calculatedWage: 72,
          status: "Submitted",
        },
        {
          id: "entry-wage",
          workOrderId: "wo-overdue",
          assignmentId: "assignment-1",
          workerId: "worker-1",
          workerName: "Ram",
          entryDate: "2026-07-25",
          goodPairs: 5,
          rejectPairs: 0,
          reworkPairs: 0,
          calculatedWage: 90,
          status: "Verified",
        },
      ],
      bomLines: [
        {
          id: "bom-1",
          itemId: "item-1",
          materialId: "rm-1",
          materialName: "Rexine",
          unit: "meter",
          quantityPerPair: 0.2,
          wastagePercent: 0,
        },
      ],
      materialIssues: [],
      wageSettlementEntries: [],
    } as unknown as FactoryData;

    const alerts = buildFactoryOperationalAlerts(factory, "2026-07-26");
    expect(alerts.every((alert) => alert.category === "factory")).toBe(true);
    expect(alerts.map((alert) => alert.id)).toEqual(
      expect.arrayContaining([
        "factory-overdue-work-orders",
        "factory-qc-pending",
        "factory-ready-stock-pending",
        "factory-material-variance",
        "factory-piece-wage-pending",
      ]),
    );
    expect(
      alerts.find((alert) => alert.id === "factory-piece-wage-pending")?.amount,
    ).toBe(90);
  });
});
