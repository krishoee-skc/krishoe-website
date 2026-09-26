import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Work Orders (lots), their stage handovers and QR sheets were taken out.
 *
 * None was ever made. The shop records a day's work in Factory Entry and posts
 * finished pairs from Packing/QC; a lot to pick first was one more box on the
 * busiest screen, for a feature nobody used. The tables stay in the database,
 * untouched and still backed up — nothing here reads or writes them for new
 * work.
 */
async function read(path: string) {
  return readFile(path, "utf8");
}

function withoutComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} should exist`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

describe("Work Orders are gone from the daily path", () => {
  it("Factory Entry has no Work Order box and sends none", async () => {
    const form = withoutComments(await read("app/admin/factory/add-work/WorkEntryForm.tsx"));
    const page = withoutComments(await read("app/admin/factory/add-work/page.tsx"));
    const route = withoutComments(await read("app/api/factory/work/route.ts"));

    for (const source of [form, page, route]) {
      expect(source).not.toMatch(/work_order_id|workOrder|WorkOrder/);
    }
  });

  it("Packing/QC posts stock without a Work Order", async () => {
    const lib = await read("lib/production-accounting.ts");
    const approve = withoutComments(functionBody(lib, "approvePackingQcAndPostStock"));
    const reverse = withoutComments(functionBody(lib, "reversePackingQcAndStock"));

    expect(approve).not.toMatch(/workOrderId/);
    expect(approve).not.toMatch(/production_work_orders/);
    expect(reverse).not.toMatch(/production_work_orders/);

    const lots = withoutComments(await read("app/admin/operations/production-accounts/lots/page.tsx"));
    expect(lots).toContain("approvePackingQcAction");
    expect(lots).not.toMatch(/workOrderId|createWorkOrderAction|createHandoverAction/);
  });

  it("nothing writes a Work Order or a handover any more", async () => {
    for (const file of [
      "lib/production-accounting.ts",
      "lib/factory-mutations.ts",
      "app/admin/operations/production-accounts/actions.ts",
    ]) {
      const source = withoutComments(await read(file));
      expect(source, file).not.toMatch(/INSERT INTO production_work_orders/);
      expect(source, file).not.toMatch(/UPDATE production_work_orders/);
      expect(source, file).not.toMatch(/INSERT INTO production_stage_handovers/);
    }
  });

  it("an old Work Order link or QR lands on Operations, not an error", async () => {
    const page = await read("app/admin/operations/production-accounts/work-order/[id]/page.tsx");
    expect(page).toContain('redirect("/admin/operations")');
    await expect(access("app/api/admin/operations/work-order/[id]/qr/route.ts")).rejects.toThrow();
  });

  it("Operations shows the paid week and today's stock, not lot counts", async () => {
    const page = withoutComments(await read("app/admin/operations/page.tsx"));
    expect(page).toContain("getWeeklyWorkerSettlements(saturdayToFridayPeriod(today))");
    expect(page).toContain("यो हप्ता बनेको");
    expect(page).toContain("आज स्टकमा चढेको");
    expect(page).not.toMatch(/activeWorkOrders|overdueWorkOrders|readyForQc|handoverMismatches|हस्तान्तरण/);
  });

  it("the exports no longer offer Work Orders or handovers", async () => {
    const route = await read("app/api/admin/operations/production-export/route.ts");
    const types = route.slice(route.indexOf("const exportTypes"), route.indexOf("] as const"));
    expect(types).not.toContain('"work-orders"');
    expect(types).not.toContain('"handovers"');
  });
});
