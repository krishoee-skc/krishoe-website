import { describe, expect, it } from "vitest";
import { outlookAdvice, outlookForDesign, stockOutlook } from "@/lib/stock-forecast";
import type { StockMovement } from "@/lib/operations";

/**
 * Telling the owner when a design runs out — and refusing to when it cannot be
 * known.
 *
 * The arithmetic is trivial; the discipline is the point. KRISHOE has three
 * weeks of history and four sales in it, and a number produced from that would
 * look exactly as confident as one produced from a year. Acting on it means
 * cutting leather for pairs nobody ordered, so most of these tests are about
 * what the forecast declines to say.
 */

const day = (offset: number) =>
  new Date(Date.UTC(2026, 7, 20) - offset * 86_400_000).toISOString();

const NOW = new Date(Date.UTC(2026, 7, 20));

const sale = (design: string, pairs: number, daysAgo: number): StockMovement =>
  ({
    id: `m-${design}-${daysAgo}`,
    createdAt: day(daysAgo),
    design,
    channel: "Online",
    sizeRun: "Mixed",
    type: "Sale Out",
    pairs,
    note: "",
  }) as StockMovement;

const other = (design: string, type: string, pairs: number, daysAgo: number): StockMovement =>
  ({ ...sale(design, pairs, daysAgo), type }) as StockMovement;

describe("when it refuses to guess", () => {
  it("says nothing about a design that has never sold", () => {
    const outlook = outlookForDesign("Sandals", 60, [], NOW);

    expect(outlook.daysOfCover).toBeNull();
    expect(outlook.status).toBe("unknown");
    expect(outlook.waitingFor).toContain("एउटै बिक्री भएको छैन");
  });

  it("names how many more sales it needs", () => {
    const outlook = outlookForDesign("Sandals", 60, [sale("Sandals", 5, 20)], NOW);

    expect(outlook.daysOfCover).toBeNull();
    // Actionable rather than mysterious: the owner can see what it waits for.
    expect(outlook.waitingFor).toContain("2 पटक");
  });

  it("will not build a rate from one busy afternoon", () => {
    // Three sales, all the same day. A rate from this says the design sells
    // fifteen pairs a day forever.
    const outlook = outlookForDesign(
      "Sandals",
      60,
      [sale("Sandals", 5, 1), sale("Sandals", 5, 1), sale("Sandals", 5, 1)],
      NOW,
    );

    expect(outlook.daysOfCover).toBeNull();
    expect(outlook.waitingFor).toContain("केही दिन थप");
  });
});

describe("when it does answer", () => {
  const steady = [sale("Chappal", 10, 30), sale("Chappal", 10, 20), sale("Chappal", 10, 10)];

  it("gives days of cover from the observed rate", () => {
    const outlook = outlookForDesign("Chappal", 30, steady, NOW);

    // 30 pairs over 30 days is 1/day, so 30 in stock is 30 days.
    expect(outlook.dailyRate).toBe(1);
    expect(outlook.daysOfCover).toBe(30);
    expect(outlook.status).toBe("healthy");
  });

  it("calls it urgent inside a week", () => {
    const outlook = outlookForDesign("Chappal", 5, steady, NOW);

    expect(outlook.daysOfCover).toBe(5);
    expect(outlook.status).toBe("urgent");
    expect(outlookAdvice(outlook)).toContain("अहिले नै बनाउन");
  });

  it("counts only sales as demand", () => {
    // An adjustment is the owner correcting the book against a physical count;
    // production and purchases are supply. Counting any as demand invents
    // sales that never happened.
    const polluted = [
      ...steady,
      other("Chappal", "Adjustment", 500, 15),
      other("Chappal", "Production In", 200, 12),
      other("Chappal", "Purchase In", 100, 8),
    ];

    expect(outlookForDesign("Chappal", 30, polluted, NOW).dailyRate).toBe(1);
  });

  it("measures from the first sale, not a fixed window", () => {
    // A design first sold last week must not be averaged over a month it did
    // not exist for — that halves its rate and hides a shortage.
    const recent = [sale("New", 10, 12), sale("New", 10, 11), sale("New", 10, 10)];
    const outlook = outlookForDesign("New", 30, recent, NOW);

    expect(outlook.historyDays).toBe(12);
    expect(outlook.dailyRate).toBe(2.5);
  });

  it("matches a design however its name was typed", () => {
    const outlook = outlookForDesign(
      "Doctor Chappal",
      30,
      [sale("  doctor   chappal ", 10, 30), sale("DOCTOR CHAPPAL", 10, 20), sale("Doctor Chappal", 10, 10)],
      NOW,
    );

    expect(outlook.saleEvents).toBe(3);
  });
});

describe("what the owner sees first", () => {
  it("puts what runs out soonest at the top and the unknowable last", () => {
    const movements = [
      sale("Fast", 20, 30), sale("Fast", 20, 20), sale("Fast", 20, 10),
      sale("Slow", 1, 30), sale("Slow", 1, 20), sale("Slow", 1, 10),
    ];

    const rows = stockOutlook(
      [
        { design: "Quiet", pairs: 40 },
        { design: "Slow", pairs: 40 },
        { design: "Fast", pairs: 6 },
        { design: "Empty", pairs: 0 },
      ],
      movements,
      NOW,
    );

    // Nobody should scroll past a dozen "not enough sales yet" rows to find the
    // one running out this week.
    expect(rows.map((row) => row.design)).toEqual(["Empty", "Fast", "Slow", "Quiet"]);
  });
});
