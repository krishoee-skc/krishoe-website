import { describe, expect, it } from "vitest";
import { formatProductionReportDetail } from "@/lib/notifications";

describe("production email report", () => {
  it("shows output, wages, cash and live factory risks", () => {
    const detail = formatProductionReportDetail(
      {
        goodPairs: 120,
        rejectedPairs: 4,
        earnedWage: 2160,
        cashPaid: 1500,
        stockPostedPairs: 100,
        completedWorkOrders: 2,
        topWorker: { name: "Ram", goodPairs: 65 },
      },
      {
        activeWorkOrders: 5,
        overdueWorkOrders: 1,
        readyForQc: 2,
        todayGoodPairs: 20,
        todayRejectedPairs: 1,
        todayEarnedWage: 360,
        todayStockPairs: 18,
        handoverMismatches: 1,
        workerBalanceDue: 7600,
        stagePending: {},
      },
    );

    expect(detail).toContain("Good production: 120 pairs");
    expect(detail).toContain("Worker wage earned: Rs. 2,160");
    expect(detail).toContain("Worker cash paid: Rs. 1,500");
    expect(detail).toContain("Top output worker: Ram (65 pairs)");
    expect(detail).toContain("Overdue Work Orders: 1");
    expect(detail).toContain("Handover mismatches: 1");
  });
});
