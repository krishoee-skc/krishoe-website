import { describe, expect, it } from "vitest";
import {
  purchaseLineIssue,
  purchaseLineIsStarted,
  type PurchaseLineDraft,
} from "@/lib/purchase-line-check";

function line(overrides: Partial<PurchaseLineDraft> = {}): PurchaseLineDraft {
  return { kind: "Trading Goods", materialId: "", materialName: "", design: "", quantity: "", rate: "", ...overrides };
}

// The gap the owner hit: quantity and rate typed, product left as "Select
// product". The old form threw the whole bill away with no word of which field.
// This is the check that now lights up that exact box before Save.
describe("what a purchase line is still missing", () => {
  it("says nothing about a line not yet started", () => {
    expect(purchaseLineIssue(line())).toBeNull();
    expect(purchaseLineIsStarted(line())).toBe(false);
  });

  it("flags the product on a trading line with quantity and rate but no product", () => {
    const issue = purchaseLineIssue(line({ quantity: "50", rate: "850" }));

    expect(issue).not.toBeNull();
    expect(issue?.design).toBe(true);
    expect(issue?.quantity).toBe(false);
    expect(issue?.rate).toBe(false);
    expect(issue?.message).toBe("This line still needs a product.");
  });

  it("flags the raw material on a raw line that has none", () => {
    const issue = purchaseLineIssue(line({ kind: "Raw Material", quantity: "10", rate: "80" }));

    expect(issue?.material).toBe(true);
    expect(issue?.message).toBe("This line still needs a raw material.");
  });

  it("accepts a raw line that names a new material instead of picking one", () => {
    const issue = purchaseLineIssue(
      line({ kind: "Raw Material", materialName: "rexin", quantity: "50", rate: "350" }),
    );

    expect(issue).toBeNull();
  });

  it("lists what is left when a product is chosen but the numbers are not", () => {
    // Product picked, so the line is started; quantity and rate still blank.
    const started = purchaseLineIssue(line({ design: "Ladies Heel" }));

    expect(started?.design).toBe(false);
    expect(started?.message).toBe("This line still needs a quantity and a rate.");
  });

  it("passes a fully filled trading line", () => {
    expect(
      purchaseLineIssue(line({ design: "Ladies Heel", quantity: "50", rate: "350" })),
    ).toBeNull();
  });

  it("passes a fully filled raw line", () => {
    expect(
      purchaseLineIssue(line({ kind: "Raw Material", materialId: "RAW-1", quantity: "10", rate: "80" })),
    ).toBeNull();
  });

  it("treats zero and blank quantity or rate as missing", () => {
    const issue = purchaseLineIssue(line({ design: "Ladies Heel", quantity: "0", rate: "0" }));

    expect(issue?.quantity).toBe(true);
    expect(issue?.rate).toBe(true);
    expect(issue?.message).toBe("This line still needs a quantity and a rate.");
  });

  // The rate belongs to the pairs, not the product picker: a raw line does not
  // ask for a product, a trading line does not ask for a raw material.
  it("does not ask a raw line for a product", () => {
    const issue = purchaseLineIssue(line({ kind: "Raw Material", quantity: "10", rate: "80", materialId: "RAW-1" }));
    expect(issue).toBeNull();
  });
});
