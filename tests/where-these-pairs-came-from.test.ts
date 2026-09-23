import { describe, expect, it } from "vitest";
import {
  agingClass,
  collectionPriorityClass,
  stockLedgerSignalClass,
  stockMovementSource,
  stockMovementTypeClass,
  stockSignalClass,
} from "@/app/admin/operations/_components/operations-record-rules";
import type { StockMovement } from "@/lib/operations";

/**
 * Where a line in the stock ledger came from.
 *
 * The operations screen is 1,062 lines and, alone among the big admin
 * screens, had no test of any kind. The one that mattered most was
 * stockMovementSource: it answers "who moved these pairs" — a dispatch, a
 * bill, the factory, a purchase, or somebody's hand — and the answer is read
 * off a note and a type in a fixed order. Get the order wrong and the ledger
 * attributes stock to the wrong part of the business, which is exactly the
 * kind of quiet wrongness nobody spots by looking.
 *
 * The order is the whole rule, so it is what these check: a dispatch beats
 * everything because the link is certain; a bill note beats the type, because
 * a POS sale is recorded as a movement whose type alone would read as a plain
 * adjustment; and anything unrecognised is called Manual rather than guessed
 * at.
 *
 * The colour helpers are here too. They are small, but each is the difference
 * between a screen that flags a problem and one that shows it in the same
 * green as everything else.
 */

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: "mv-1",
    createdAt: "2026-09-23T04:00:00.000Z",
    design: "bag open",
    channel: "Retail",
    sizeRun: "Mixed",
    type: "Adjustment",
    pairs: 12,
    note: "",
    ...overrides,
  } as StockMovement;
}

const dispatchItem = {
  vehicleNumber: "BA 2 KHA 1234",
  marketRoute: "Narayangadh — Bharatpur",
} as Parameters<typeof stockMovementSource>[1];

describe("where a stock movement came from", () => {
  it("names the vehicle when the movement is linked to a dispatch", () => {
    const source = stockMovementSource(movement({ type: "Dispatch Out" }), dispatchItem);
    expect(source.label).toBe("BA 2 KHA 1234");
    expect(source.detail).toBe("Narayangadh — Bharatpur");
  });

  it("still names the vehicle when the route was never filled in", () => {
    const source = stockMovementSource(movement(), {
      ...dispatchItem,
      marketRoute: "",
    } as typeof dispatchItem);
    expect(source.label).toBe("BA 2 KHA 1234");
    expect(source.detail).toBe("Dispatch item");
  });

  it("reads a bill number in the note as a counter sale", () => {
    // The movement a POS sale writes is typed as an ordinary out-movement; the
    // bill number in the note is the only thing that says it was a sale. Read
    // the type first and every counter sale is filed as something else.
    expect(stockMovementSource(movement({ note: "KR-BILL-0042" })).label).toBe("POS billing");
    expect(stockMovementSource(movement({ note: "kr-rt-0042 return" })).label).toBe("POS billing");
  });

  it("lets the dispatch link win over a bill note", () => {
    // Both present: the link is a stored relation, the note is text somebody
    // typed. The relation is the more certain of the two.
    const source = stockMovementSource(movement({ note: "KR-BILL-0042" }), dispatchItem);
    expect(source.label).toBe("BA 2 KHA 1234");
  });

  it("names the factory for production, the supplier for a purchase", () => {
    expect(stockMovementSource(movement({ type: "Production In" })).label).toBe("Production");
    expect(stockMovementSource(movement({ type: "Purchase In" })).label).toBe("Purchase");
    expect(stockMovementSource(movement({ type: "Purchase In" })).detail).toBe(
      "Trading goods received",
    );
  });

  it("calls a correction a correction", () => {
    expect(stockMovementSource(movement({ type: "Adjustment" })).label).toBe("Adjustment");
  });

  it("says Manual rather than guessing", () => {
    // A movement with no link, no bill note and a type not named above is not
    // attributed to anything. An unexplained line should read as unexplained.
    expect(stockMovementSource(movement({ type: "Sale Out" })).label).toBe("Manual");
  });
});

describe("the colour a row earns", () => {
  it("shows pairs coming in as good and pairs going out as watched", () => {
    expect(stockMovementTypeClass("Production In")).toContain("brand-green");
    expect(stockMovementTypeClass("Purchase In")).toContain("brand-green");
    expect(stockMovementTypeClass("Return In")).toContain("brand-green");
    expect(stockMovementTypeClass("Dispatch Out")).toContain("brand-gold-ink");
    expect(stockMovementTypeClass("Sale Out")).toContain("brand-gold-ink");
  });

  it("flags an unhealthy stock signal rather than colouring it green", () => {
    expect(stockSignalClass("Healthy")).toContain("brand-green");
    expect(stockSignalClass("Return watch")).toContain("brand-gold-ink");
    // Anything else is a problem, and must not fall through to green.
    expect(stockSignalClass("Oversold")).toContain("brand-clay");
  });

  it("flags an unbalanced ledger the same way", () => {
    expect(stockLedgerSignalClass("Balanced")).toContain("brand-green");
    expect(stockLedgerSignalClass("Watch")).toContain("brand-gold-ink");
    expect(stockLedgerSignalClass("Short")).toContain("brand-clay");
  });

  it("marks a debt that needs chasing", () => {
    expect(collectionPriorityClass("Clear")).toContain("brand-green");
    expect(collectionPriorityClass("Monitor")).toContain("brand-gold-ink");
    expect(collectionPriorityClass("Medium")).toContain("brand-gold-ink");
    expect(collectionPriorityClass("Urgent")).toContain("brand-clay");
  });

  it("darkens money as it ages", () => {
    expect(agingClass("0-30 days")).toContain("brand-green");
    expect(agingClass("31-60 days")).toContain("brand-gold-ink");
    expect(agingClass("60+ days")).toContain("brand-clay");
  });
});
