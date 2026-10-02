import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CANCEL_NOTE, cancelledBillOf, withoutCancelledBills } from "@/lib/cancelled-bills";
import { outlookForDesign } from "@/lib/stock-forecast";
import { movementKind } from "@/lib/stock-page-rules";
import type { StockMovement } from "@/lib/operations";

const move = (type: StockMovement["type"], pairs: number, note: string, design = "bantu hill") =>
  ({ id: `${type}-${note}`, createdAt: "2026-10-01T12:00:00.000Z", design, channel: "Factory", sizeRun: "Mixed", type, pairs, note }) as StockMovement;

/**
 * Owner, 2026-10-02: Operations said bantu hill had 41% returned. Every one of
 * those "returns" was a test bill being cancelled; no customer had sent a pair
 * back.
 */
describe("a cancelled test bill is neither a sale nor a return", () => {
  const movements = [
    move("Production In", 60, "made"),
    move("Sale Out", 7, "KRB009 sale KR-201"),
    move("Sale Out", 16, "KRB003 sale KR-201"),
    move("Return In", 16, `KRB003 ${CANCEL_NOTE}`),
    move("Return In", 2, "KRB010 return KR-201"),
  ];

  it("knows a cancel's put-back by its note, and nothing else", () => {
    expect(cancelledBillOf(move("Return In", 1, `KRB003 ${CANCEL_NOTE}`))).toBe("KRB003");
    expect(cancelledBillOf(move("Return In", 1, "KRB010 return KR-201"))).toBeNull();
    expect(cancelledBillOf(move("Sale Out", 1, `KRB003 ${CANCEL_NOTE}`))).toBeNull();
  });

  it("drops both halves of the cancelled bill and keeps real sales and returns", () => {
    const kept = withoutCancelledBills(movements).map((item) => item.note);
    expect(kept).toEqual(["made", "KRB009 sale KR-201", "KRB010 return KR-201"]);
  });

  it("leaves the pairs on the shelf the same either way", () => {
    const shelf = (list: StockMovement[]) =>
      list.reduce((total, item) => total + (item.type === "Sale Out" ? -item.pairs : item.pairs), 0);
    expect(shelf(withoutCancelledBills(movements))).toBe(shelf(movements));
  });

  it("does not count a cancelled sale as demand", () => {
    expect(outlookForDesign("bantu hill", 53, movements, new Date("2026-10-02T00:00:00.000Z")).soldInWindow).toBe(7);
  });

  it("says so on the stock page", () => {
    expect(movementKind(move("Return In", 16, `KRB003 ${CANCEL_NOTE}`))).toBe("Bill Cancelled");
    expect(movementKind(move("Return In", 2, "KRB010 return KR-201"))).toBe("Return In");
  });

  it("from now on takes the pairs off the shoe's sold and returned counts when a bill is cancelled", async () => {
    const source = await readFile("lib/pos-void.ts", "utf8");
    expect(source).toContain("await undoCancelledSaleCounts(db, back);");
    const store = await readFile("lib/operations-postgres.ts", "utf8");
    expect(store).toContain("soldPairs: Math.max(0, stock.soldPairs - pairs),");
    expect(store).toContain("returnedPairs: Math.max(0, stock.returnedPairs - pairs),");
  });
});
