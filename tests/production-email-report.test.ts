import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { formatProductionReportDetail } from "@/lib/notifications";

const control = {
  todayGoodPairs: 20,
  todayRejectedPairs: 1,
  todayEarnedWage: 360,
  activeWorkerCount: 3,
  todayStockPairs: 18,
  todayStagePairs: [{ stage: "Upper", pairs: 20 }],
  workerBalanceDue: 7600,
};

describe("production email report", () => {
  it("shows output, wages, cash and live factory risks", () => {
    const detail = formatProductionReportDetail(
      {
        goodPairs: 120,
        rejectedPairs: 4,
        earnedWage: 2160,
        cashPaid: 1500,
        stockPostedPairs: 60,
        stagePairs: [
          { stage: "Fibermen", pairs: 60 },
          { stage: "Upper", pairs: 60 },
        ],
        topWorker: { name: "Ram", goodPairs: 65 },
      },
      control,
    );

    expect(detail).toContain("Worker wage earned: Rs. 2,160");
    expect(detail).toContain("Worker cash paid: Rs. 1,500");
    expect(detail).toContain("Top output worker: Ram (65 pairs of work)");
    expect(detail).toContain("Total worker balance due: Rs. 7,600");
    // Work Orders and handovers were taken out; the report no longer counts them.
    expect(detail).not.toMatch(/Work Order|Handover|Ready for packing/);
  });

  /**
   * 60 pairs through Upper and Fibermen read as "Good production: 120", and
   * "Finished stock posted" read the QC postings alone — 0 every day, while the
   * factory posted 180 pairs from the work screen (owner, 2026-09-29).
   */
  it("says made is pairs into stock, and lists the stages without adding them", () => {
    const detail = formatProductionReportDetail(
      {
        goodPairs: 120,
        rejectedPairs: 0,
        earnedWage: 0,
        cashPaid: 0,
        stockPostedPairs: 60,
        stagePairs: [
          { stage: "Fibermen", pairs: 60 },
          { stage: "Upper", pairs: 60 },
        ],
        topWorker: null,
      },
      control,
    );
    expect(detail).toContain("Pairs made (into stock): 60 pairs");
    expect(detail).toContain("Work by stage: Fibermen 60 · Upper 60");
    expect(detail).not.toContain("120");
    expect(detail).not.toContain("Good production");
  });

  it("says so when nobody entered work", () => {
    const detail = formatProductionReportDetail(
      { goodPairs: 0, rejectedPairs: 0, earnedWage: 0, cashPaid: 0, stockPostedPairs: 0, stagePairs: [], topWorker: null },
      control,
    );
    expect(detail).toContain("Work by stage: No work entered");
  });

  it("counts stock posted from every Production In, not the QC postings alone", async () => {
    const source = (await readFile("lib/production-accounting.ts", "utf8")).replace(/\r\n/g, "\n");
    const period = source.slice(source.indexOf("export async function getProductionPeriodSummary"));
    const query = period.slice(0, period.indexOf("AS stock_posted_pairs"));
    expect(query).toContain("FROM stock_movements");
    expect(query).toContain("type = 'Production In'");
    expect(query).not.toContain("FROM production_qc_postings");
  });
});
