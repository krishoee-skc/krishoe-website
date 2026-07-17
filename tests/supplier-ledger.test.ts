import { describe, expect, it } from "vitest";
import { supplierNameKey } from "@/lib/purchasing";

// Two ledgers for one supplier split what the shop owes them. Whichever row is
// picked at the next purchase, the balance is wrong, and nothing on screen says
// why. This is the rule that decides whether a typed name is someone new.
describe("telling two supplier names apart", () => {
  it("treats the same name typed the same way as one supplier", () => {
    expect(supplierNameKey("rijal dai")).toBe(supplierNameKey("rijal dai"));
  });

  it("ignores capitals", () => {
    // "Rijal Dai" on Monday and "rijal dai" on Tuesday is one person.
    expect(supplierNameKey("Rijal Dai")).toBe(supplierNameKey("rijal dai"));
  });

  it("ignores stray spaces", () => {
    expect(supplierNameKey("  rijal dai ")).toBe(supplierNameKey("rijal dai"));
    expect(supplierNameKey("rijal  dai")).toBe(supplierNameKey("rijal dai"));
  });

  it("still tells different suppliers apart", () => {
    expect(supplierNameKey("Rijal Dai")).not.toBe(supplierNameKey("Nobel Shoe"));
  });

  it("does not merge two names that only start alike", () => {
    expect(supplierNameKey("Rijal Dai")).not.toBe(supplierNameKey("Rijal Dai Traders"));
  });
});
