import { describe, expect, it } from "vitest";
import { quoteWork, rateFor, type FactoryRate } from "@/lib/factory-rate-book";

/**
 * Which wage rate applies.
 *
 * The work-entry screen now holds the whole rate book and answers without
 * asking the server, so this has to pick exactly the rate the database picks
 * when the entry is saved. A screen that quotes one figure and a ledger that
 * records another is the argument this exists to prevent.
 */
function rate(over: Partial<FactoryRate> = {}): FactoryRate {
  return {
    itemId: "item-1",
    workerId: "",
    stage: "Upper",
    workerCategory: "Upper",
    ratePerPair: 40,
    effectiveFrom: "2026-01-01",
    source: "Production stage",
    ...over,
  };
}

const LOOKUP = {
  itemId: "item-1",
  workerId: "w1",
  stage: "Upper",
  workerCategory: "Upper",
  onDate: "2026-09-08",
};

describe("picking the rate that applies", () => {
  it("prefers a rate set for this worker over the stage rate", () => {
    const found = rateFor(
      [
        rate({ ratePerPair: 40, source: "Production stage" }),
        rate({ ratePerPair: 45, workerId: "w1", source: "Worker override" }),
      ],
      LOOKUP,
    );

    expect(found?.ratePerPair).toBe(45);
    expect(found?.source).toBe("Worker override");
  });

  it("prefers the stage rate over the older factory rate", () => {
    const found = rateFor(
      [
        rate({ ratePerPair: 35, source: "Factory rate" }),
        rate({ ratePerPair: 40, source: "Production stage" }),
      ],
      LOOKUP,
    );

    expect(found?.source).toBe("Production stage");
  });

  it("does not hand one worker's override to another", () => {
    const found = rateFor(
      [
        rate({ ratePerPair: 40, source: "Production stage" }),
        rate({ ratePerPair: 60, workerId: "w2", source: "Worker override" }),
      ],
      LOOKUP,
    );

    expect(found?.ratePerPair).toBe(40);
  });

  it("does not price today's work at a rate that starts tomorrow", () => {
    // A raise agreed for next month must not appear on this morning's entry.
    const found = rateFor(
      [
        rate({ ratePerPair: 40, effectiveFrom: "2026-01-01" }),
        rate({ ratePerPair: 50, effectiveFrom: "2026-10-01" }),
      ],
      LOOKUP,
    );

    expect(found?.ratePerPair).toBe(40);
  });

  it("takes the newest rate that has already started", () => {
    const found = rateFor(
      [
        rate({ ratePerPair: 40, effectiveFrom: "2026-01-01" }),
        rate({ ratePerPair: 44, effectiveFrom: "2026-06-01" }),
        rate({ ratePerPair: 42, effectiveFrom: "2026-03-01" }),
      ],
      LOOKUP,
    );

    expect(found?.ratePerPair).toBe(44);
  });

  it("keeps rates for other items out of it", () => {
    expect(rateFor([rate({ itemId: "item-2", ratePerPair: 99 })], LOOKUP)).toBeNull();
  });

  it("keeps an old factory rate to its own worker category", () => {
    const found = rateFor(
      [rate({ workerCategory: "Fibermen", ratePerPair: 55, source: "Factory rate" })],
      LOOKUP,
    );

    expect(found).toBeNull();
  });

  it("keeps a stage rate to its own stage", () => {
    const found = rateFor([rate({ stage: "Fiber silai", ratePerPair: 55 })], LOOKUP);

    expect(found).toBeNull();
  });

  it("says nothing rather than zero when no rate was ever set", () => {
    // A missing rate is a question for the owner. Answering "0" would quietly
    // record a day's work as worth nothing.
    expect(rateFor([], LOOKUP)).toBeNull();
    expect(rateFor([rate({ ratePerPair: 0 })], LOOKUP)).toBeNull();
  });
});

describe("what the screen shows before saving", () => {
  it("prices the pairs at the rate that applies", () => {
    const quote = quoteWork([rate({ ratePerPair: 40 })], LOOKUP, 12);

    expect(quote.rate).toBe(40);
    expect(quote.amount).toBe(480);
    expect(quote.source).toBe("Production stage");
  });

  it("rounds to the paisa, the way the ledger will store it", () => {
    // The same rounding as the database's ROUND(rate * pairs, 2), so the figure
    // on screen is the figure that gets saved.
    const quote = quoteWork([rate({ ratePerPair: 25.555 })], LOOKUP, 3);

    expect(quote.amount).toBe(76.66);
  });

  it("offers no amount when there is no rate to price it at", () => {
    const quote = quoteWork([], LOOKUP, 12);

    expect(quote.rate).toBeNull();
    expect(quote.amount).toBe(0);
  });
});
