import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildInsight, periodWindow, readPeriod } from "@/lib/reports";

/**
 * The report hub after the owner's sample, 2026-09-28: a period at the top,
 * rupees on the money cards against the stretch before, four groups, one
 * factory card, no false "0 visits", and the sold-out shoe named.
 */
const counts = {
  pos_invoices: 10,
  ledger_balance: 0,
  performance: 0,
  audit: 0,
  stock_moves: 0,
  factory_work: 0,
  reviews: 0,
  purchases: 2,
  orders: 0,
  out_of_stock: 1,
  workers: 8,
};

describe("the period", () => {
  // 2083/06/12 BS is 28 September 2026; Asoj began on 17 September.
  const now = new Date("2026-09-28T06:00:00Z");

  it("is this Bikram Sambat month unless another is asked for", () => {
    expect(readPeriod(undefined)).toBe("month");
    expect(readPeriod("nonsense")).toBe("month");
    expect(readPeriod("today")).toBe("today");
  });

  it("covers the BS month so far, against as many days of the month before", () => {
    const window = periodWindow("month", now);
    expect(window.current).toEqual({ startKey: "2026-09-17", endKey: "2026-09-29" });
    expect(window.previous).toEqual({ startKey: "2026-08-17", endKey: "2026-08-29" });
    expect(window.rangeLabel).toBe("2083/06/01 – 2083/06/12");
  });

  it("covers the whole of last month against the whole month before it", () => {
    const window = periodWindow("last", now);
    expect(window.current).toEqual({ startKey: "2026-08-17", endKey: "2026-09-17" });
    expect(window.previous?.endKey).toBe("2026-08-17");
  });

  it("counts today and seven days in Nepal time, and 'all' has no bounds", () => {
    expect(periodWindow("today", now).current).toEqual({ startKey: "2026-09-28", endKey: "2026-09-29" });
    expect(periodWindow("week", now).current).toEqual({ startKey: "2026-09-22", endKey: "2026-09-29" });
    const all = periodWindow("all", now);
    expect(all.current).toBeNull();
    expect(all.previous).toBeNull();
  });
});

describe("the sold-out note", () => {
  it("names the shoe and says 'shoe' for one", () => {
    const insight = buildInsight(counts, "Doctor Chappal");
    expect(insight?.titleEn).toBe("1 shoe shows as sold out: Doctor Chappal");
    expect(insight?.titleNe).toContain("Doctor Chappal");
  });
});

describe("the cards", () => {
  it("lead with rupees, group into four, and keep one factory card", async () => {
    const lib = await readFile("lib/reports.ts", "utf8");
    const page = await readFile("app/admin/reports/page.tsx", "utf8");
    expect(lib).toContain('valueKind: "money"');
    expect(lib).toContain("change: compare ? changeOf(all.sales_net, all.prev_sales_net) : null,");
    expect(lib).not.toContain('id: "workers"');
    expect(page).toContain('{ key: "money", en: "💰 Money", ne: "💰 पैसा" }');
    expect(page).toContain("REPORT_PERIODS.map((option)");
  });

  it("show no number for visits kept in Google Analytics, rather than a false 0", async () => {
    const lib = await readFile("lib/reports.ts", "utf8");
    const channels = lib.slice(lib.indexOf('id: "channels"'), lib.indexOf('id: "voice"'));
    expect(channels).toContain('valueKind: "none"');
  });

  it("do not call sales less purchases profit before a pair is costed", async () => {
    const lib = await readFile("lib/reports.ts", "utf8");
    expect(lib).toContain("ready: all.costed_shoes > 0,");
  });
});
