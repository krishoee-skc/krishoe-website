import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Every quick-entry form on the operations page saved and redirected to the
 * same page in silence. The row had been written, but nothing on screen said
 * so — indistinguishable from a button that did nothing, which left the owner
 * unable to tell a broken app from their own mistake.
 */
describe("operations save feedback", () => {
  it("carries a message back on every save", async () => {
    const source = await readFile("app/admin/operations/actions.ts", "utf8");
    const calls = source.match(/refreshOperationsPage\([^)]*\)/g) ?? [];

    // The declaration plus one call per action.
    expect(calls.length).toBeGreaterThan(20);

    for (const call of calls) {
      if (call.startsWith("refreshOperationsPage(message")) continue; // the declaration
      expect(call, call).toMatch(/refreshOperationsPage\("/);
    }
  });

  it("puts the message in the redirect", async () => {
    const source = await readFile("app/admin/operations/actions.ts", "utf8");
    expect(source).toContain("?saved=${encodeURIComponent(message)}");
  });

  it("names what happened, not just that something did", async () => {
    const source = await readFile("app/admin/operations/actions.ts", "utf8");
    // In Nepali, and naming the shop: these two are the entries the owner
    // reaches for, and the only ones whose effect leaves this page.
    expect(source).toContain("स्टक चढ्यो ✅ तयारी स्टक र पसल दुवैमा मिल्यो।");
    expect(source).toContain("तयारी स्टक सुरक्षित भयो ✅ पसलमा पनि मिल्यो।");
  });

  it("renders the message where it will be read", async () => {
    const page = await readFile("app/admin/operations/page.tsx", "utf8");
    expect(page).toContain("(await searchParams)?.saved");
    expect(page).toContain('role="status"');
  });
});

describe("operations storage note", () => {
  it("does not send the owner looking for a file on disk", async () => {
    const source = await readFile(
      "app/admin/operations/_components/OperationsQuickEntry.tsx",
      "utf8",
    );
    // The live shop runs on Postgres; naming data/operations.json described a
    // backend this deployment has not used for months.
    expect(source).not.toContain("data/operations.json");
    expect(source).toContain("KRISHOE database");
  });
});
