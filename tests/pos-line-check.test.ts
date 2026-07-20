import { describe, expect, it } from "vitest";
import { posLineIssue, posLineIsStarted, type PosLineDraft } from "@/lib/pos-line-check";

function line(overrides: Partial<PosLineDraft> = {}): PosLineDraft {
  return { sku: "", design: "", quantity: "", rate: "", ...overrides };
}

// The same field-level signal the purchase form has, now for a counter sale: a
// line needs a design, a quantity and a rate, and the exact missing box is named
// before the cashier presses Save.
describe("what a POS sale line is still missing", () => {
  it("says nothing about a line not yet started", () => {
    expect(posLineIssue(line())).toBeNull();
    expect(posLineIsStarted(line())).toBe(false);
  });

  it("flags the design on a line with a rate but no design", () => {
    const issue = posLineIssue(line({ rate: "500" }));

    expect(issue?.design).toBe(true);
    expect(issue?.message).toContain("a design");
  });

  it("flags quantity and rate when only a design is chosen", () => {
    const issue = posLineIssue(line({ design: "Ladies Heel" }));

    expect(issue?.message).toBe("This line still needs a quantity and a rate.");
  });

  it("passes a full sale line", () => {
    expect(posLineIssue(line({ design: "Ladies Heel", quantity: "2", rate: "1799" }))).toBeNull();
  });

  it("treats zero quantity or rate as missing", () => {
    const issue = posLineIssue(line({ design: "Ladies Heel", quantity: "0", rate: "1799" }));

    expect(issue?.quantity).toBe(true);
    expect(issue?.rate).toBe(false);
  });

  it("counts a line with only a SKU as started, so it prompts for the rest", () => {
    const issue = posLineIssue(line({ sku: "LH-01" }));

    expect(posLineIsStarted(line({ sku: "LH-01" }))).toBe(true);
    expect(issue?.design).toBe(true);
  });
});
