import { describe, expect, it } from "vitest";
import { customerStage, STAGE_META, followUpMessage } from "@/lib/customer-stage";

/**
 * The CRM ladder, worked out from a customer's orders. Pinned so a later change
 * to the thresholds is deliberate, and so the boundaries (0, 1, 2, 3 completed
 * orders) never slip.
 */
describe("customer stage from orders", () => {
  it("climbs the ladder by completed orders", () => {
    expect(customerStage(0, false)).toBe("New");
    expect(customerStage(0, true)).toBe("Interested"); // ordered but nothing closed
    expect(customerStage(1, true)).toBe("Ordered");
    expect(customerStage(2, true)).toBe("Repeat");
    expect(customerStage(3, true)).toBe("VIP");
    expect(customerStage(9, true)).toBe("VIP"); // stays VIP above the threshold
  });

  it("treats a new account with no orders as New, not Interested", () => {
    expect(customerStage(0, false)).toBe("New");
  });

  it("has a label and colour for every stage", () => {
    for (const stage of ["New", "Interested", "Ordered", "Repeat", "VIP"] as const) {
      expect(STAGE_META[stage].en.length).toBeGreaterThan(0);
      expect(STAGE_META[stage].ne.length).toBeGreaterThan(0);
      expect(STAGE_META[stage].className).toContain("bg-");
    }
  });
});

describe("the WhatsApp follow-up greeting", () => {
  it("writes the customer's name into every stage's message", () => {
    for (const stage of ["New", "Interested", "Ordered", "Repeat", "VIP"] as const) {
      const msg = followUpMessage(stage, "Ram");
      expect(msg).toContain("Ram");
      expect(msg).toContain("krishoe.com/shop"); // always points them to the shop
    }
  });

  it("reads cleanly with no name", () => {
    const msg = followUpMessage("New");
    expect(msg).toContain("नमस्ते");
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("  "); // no double space where a name would go
  });

  it("greets a VIP differently from a new customer", () => {
    expect(followUpMessage("VIP", "Sita")).not.toBe(followUpMessage("New", "Sita"));
  });
});
