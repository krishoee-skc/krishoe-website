import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { colourSwatch, compactSizes } from "@/lib/shoe-colour";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-04 ("1 code garau"): the worker's ledger reads clean —
 * Correct and Delete behind one ✏️ for the Owner — and the pairs, the rate and
 * the colour read clearly.
 */
describe("the piece ledger", () => {
  it("keeps Correct and Delete behind the Owner's ✏️", async () => {
    const ledger = await read("app/admin/factory/ledger/PieceLedger.tsx");
    expect(ledger).toContain(") : canFix ? (");
    expect(ledger).toContain('aria-label={text("Fix this entry", "यो entry सच्याउने")}');
    const page = await read("app/admin/factory/ledger/page.tsx");
    expect(page).toContain('getSessionAdminRole(session!) === "Owner"');
    // the server's own rule, unchanged: only the Owner may correct or delete
    const policy = await read("lib/factory-api-policy.ts");
    expect(policy).toContain('"/api/factory/ledger/edit": {\n    POST: { permissions: ["wages:write"], ownerOnly: true },');
    expect(policy).toContain('"/api/factory/ledger/delete": {\n    POST: { permissions: ["wages:write"], ownerOnly: true },');
  });

  it("shows colour with its swatch, the size as a run, and work from a photo", async () => {
    expect(colourSwatch("Red")).toBe("#C62828");
    expect(colourSwatch("dark red")).toBe("#C62828");
    expect(colourSwatch("Mehendi")).toBeNull();
    expect(compactSizes("36, 37, 38, 39, 40, 41")).toBe("36–41");
    expect(compactSizes("21/25")).toBe("21/25");
    expect(compactSizes("36, 38, 40")).toBe("36, 38, 40");
    const route = await read("app/api/factory/ledger/route.ts");
    expect(route).toContain("(work.submission_key LIKE 'worker-photo:%') AS from_photo");
  });
});
