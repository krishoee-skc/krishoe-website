import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  bikramMonthKeyOf,
  bikramMonthRange,
  recentBikramMonths,
} from "@/lib/bikram-sambat";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * Wages at this factory are agreed by the Nepali month, and Bhadra runs 17
 * August to 17 September. Counted on the English month, Bhadra split in half —
 * work from the 17th landed in "August" and the rest in "September" — so "how
 * much did I earn in Bhadra", the question the worker actually asks, was one
 * the app could not answer.
 */
describe("a Bikram Sambat month as a period", () => {
  it("covers the days that month actually runs", () => {
    expect(bikramMonthRange("2083-05")).toEqual({
      startKey: "2026-08-17",
      endKey: "2026-09-17",
    });
  });

  it("does not assume every month is the same length", () => {
    // Asoj 2083 runs 31 days, to 18 October. Bhadra's start plus one calendar
    // month lands on the 17th — a day short — and that day's wages would fall
    // out of the month they were earned in.
    expect(bikramMonthRange("2083-06")).toEqual({
      startKey: "2026-09-17",
      endKey: "2026-10-18",
    });
  });

  it("refuses an English month wearing the same shape", () => {
    // "2026-08" is a valid-looking YYYY-MM. Read as Bikram Sambat it is 1969,
    // and a stale link would have reported a worker's pay for that year.
    expect(bikramMonthRange("2026-08")).toBeNull();
    expect(bikramMonthRange("2025-01")).toBeNull();
    expect(bikramMonthRange("not-a-month")).toBeNull();
    expect(bikramMonthRange("2083-13")).toBeNull();
  });

  it("names the month a date falls in", () => {
    // 17 August is the first day of Bhadra; the 16th is still Shrawan.
    expect(bikramMonthKeyOf("2026-08-17T06:00:00.000Z")).toBe("2083-05");
    expect(bikramMonthKeyOf("2026-08-16T06:00:00.000Z")).toBe("2083-04");
  });

  it("lists months by name, not by number", () => {
    const months = recentBikramMonths(3, new Date("2026-08-22T06:00:00.000Z"));

    expect(months.map((month) => month.key)).toEqual(["2083-05", "2083-04", "2083-03"]);
    // Nobody should convert 17 August in their head to ask about भाद्र.
    expect(months[0].label).toContain("भाद्र");
    // bikramMonthLabel already carries the year; appending it read "भाद्र २०८३ 2083".
    expect(months[0].label).not.toContain("2083");
  });
});

/**
 * The one number this changes is the one a worker is paid from.
 */
describe("what the factory counts a month as", () => {
  it("sums a worker's month over the Bikram Sambat range", async () => {
    const mutations = code(await readFile("lib/factory-mutations.ts", "utf8"));

    expect(mutations).toContain("bikramMonthRange(month)");
    // Both ends, never start + INTERVAL '1 month'.
    expect(mutations).not.toMatch(/date < \(\$2::date \+ INTERVAL '1 month'\)/);
  });

  it("files posted work under the Nepali month it was worked in", async () => {
    const mutations = code(await readFile("lib/factory-mutations.ts", "utf8"));

    // .slice(0, 7) gave the English month, so work done on 17 August went to a
    // month the shop had already closed.
    expect(mutations).toContain("bikramMonthKeyOf(input.date)");
    expect(mutations).not.toContain("input.date.slice(0, 7)");
  });

  it("asks for the month by a name that cannot be mistaken", async () => {
    for (const file of [
      "app/api/factory/ledger/route.ts",
      "app/api/factory/salary/route.ts",
      "app/api/factory/monthly-summary/route.ts",
    ]) {
      const route = code(await readFile(file, "utf8"));

      // Both calendars write YYYY-MM. The parameter name is what stops one
      // being read as the other.
      expect(route, file).toContain("bsMonth");
      expect(route, file).not.toContain('searchParams.get("month")');
    }
  });

  it("stores a payment against the month it was agreed in", async () => {
    const mutations = code(await readFile("lib/factory-mutations.ts", "utf8"));

    // Written as the Bikram month's first A.D. day, so Postgres keeps
    // comparing dates the way it always has and the salary screen — which now
    // reads a BS range — finds the payment.
    expect(mutations).toContain("bikramMonthRange(input.salaryPeriodMonth)?.startKey");
  });
});

describe("the month picker", () => {
  it("replaced the browser's English one everywhere it stood", async () => {
    for (const file of [
      "app/admin/factory/ledger/page.tsx",
      "app/admin/factory/salary/page.tsx",
      "app/admin/factory/reports/page.tsx",
    ]) {
      const page = await readFile(file, "utf8");

      expect(page, file).toContain("BikramMonthPicker");
      // <input type="month"> only speaks the English calendar.
      expect(page, file).not.toContain('type="month"');
    }
  });
});

describe("what a worker sees of their own months", () => {
  it("is named, not numbered", async () => {
    const portal = code(await readFile("lib/factory-worker-portal.ts", "utf8"));

    // It read "2026-07" — a month the worker was never paid for and did not
    // recognise, on the one screen they read themselves.
    expect(portal).toContain("bikramMonthLabel");
  });
});
