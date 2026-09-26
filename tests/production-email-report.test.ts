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
        topWorker: { name: "Ram", goodPairs: 65 },
      },
      {
        todayGoodPairs: 20,
        todayRejectedPairs: 1,
        todayEarnedWage: 360,
        activeWorkerCount: 3,
        todayStockPairs: 18,
        workerBalanceDue: 7600,
      },
    );

    expect(detail).toContain("Good production: 120 pairs");
    expect(detail).toContain("Worker wage earned: Rs. 2,160");
    expect(detail).toContain("Worker cash paid: Rs. 1,500");
    expect(detail).toContain("Top output worker: Ram (65 pairs)");
    expect(detail).toContain("Total worker balance due: Rs. 7,600");
    // Work Orders and handovers were taken out; the report no longer counts them.
    expect(detail).not.toMatch(/Work Order|Handover|Ready for packing/);
  });
});
