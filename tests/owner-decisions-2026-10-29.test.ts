import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canAccessAdminPath, canAdmin } from "@/lib/admin-role-permissions";

/**
 * The owner's choices of 2026-10-29, after the bug audit: rejected pairs are
 * not paid (DEC-002 b), sixty orders an hour from one address (DEC-003 b), and
 * the staff-role sample.
 */
const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

describe("DEC-002: the good pairs are paid, not the rejected ones", () => {
  it("books a new entry and a corrected one by the good pairs", async () => {
    const lib = await read("lib/factory-mutations.ts");
    expect(lib).toContain("ROUND($10::numeric * GREATEST($8::integer - $12::integer, 0), 2)");
    expect(lib).toContain("const amountEarned = money(rate * Math.max(0, input.pairsCount - rejectPairs));");
  });

  it("shows the same wage on the form before it saves", async () => {
    const form = await read("app/admin/factory/add-work/WorkEntryForm.tsx");
    expect(form).toContain("const payable = pairsNow > 0 ? Math.round(((calculatedAmount * paidPairs) / pairsNow) * 100) / 100 : 0;");
    expect(form).toContain("(${paidPairs} paid)");
  });
});

describe("DEC-003: sixty checkouts an hour from one address", () => {
  it("raises only the address limit", async () => {
    const actions = await read("app/actions.ts");
    expect(actions).toContain('const CHECKOUT_IP_LIMIT = { bucket: "submission:checkout-ip", maxAttempts: 60, windowMs: 60 * 60 * 1000 };');
    expect(actions).toContain("maxAttempts: 5,\n  windowMs: 24 * 60 * 60 * 1000,");
    expect(actions).toContain('enforceSubmissionLimit("checkout", 8)');
  });
});

describe("the staff-role sample", () => {
  it("keeps monthly salaries from the factory supervisor, not from HR", () => {
    expect(canAccessAdminPath("Factory", "/admin/factory/salary")).toBe(false);
    expect(canAccessAdminPath("Factory", "/admin/factory/add-work")).toBe(true);
    expect(canAccessAdminPath("Factory", "/admin/factory/ledger")).toBe(true);
    expect(canAccessAdminPath("HR", "/admin/factory/salary")).toBe(true);
  });

  it("gives activity, security and monitoring to the Owner and the Manager only", () => {
    for (const role of ["Accountant", "HR", "Inventory", "Sales", "Factory", "Viewer"] as const) {
      expect(canAdmin(role, "activity:read"), role).toBe(false);
      expect(canAdmin(role, "security:read"), role).toBe(false);
    }
    expect(canAdmin("Manager", "activity:read")).toBe(true);
    expect(canAdmin("Manager", "security:read")).toBe(true);
  });

  it("leaves everyone their own sign-ins and passkeys", () => {
    for (const role of ["Accountant", "HR", "Inventory", "Sales", "Factory", "Viewer"] as const) {
      expect(canAdmin(role, "devices:read"), role).toBe(true);
    }
  });

  it("puts a rule on the three pages that had none", () => {
    expect(canAccessAdminPath("Sales", "/admin/security-overview")).toBe(false);
    expect(canAccessAdminPath("Manager", "/admin/security-overview")).toBe(true);
    expect(canAccessAdminPath("Manager", "/admin/robots")).toBe(false);
    expect(canAccessAdminPath("Owner", "/admin/robots")).toBe(true);
    expect(canAccessAdminPath("Accountant", "/admin/getting-started")).toBe(false);
    expect(canAccessAdminPath("Manager", "/admin/getting-started")).toBe(true);
  });
});
