import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { nepalDay } from "@/lib/nepal-day";
import { couponHasEnded, couponHasStarted } from "@/lib/coupons";
import { keptTableNames } from "@/lib/backup-table-manifest.mjs";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/** Owner, 2026-10-21, the choices page: 1, 2 and 3 garau. */
describe("2 · the day turns at midnight in Nepal", () => {
  it("puts a bill at 12:53 am on that day, not the one before", () => {
    // 20 Oct, 00:53 in Nepal — 19 Oct in UTC.
    expect(nepalDay("2026-10-19T19:08:28.160Z")).toBe("2026-10-20");
    // KRB009 was billed at 01:27 UTC — 7:12 am in Nepal, the same day either way.
    expect(nepalDay("2026-10-20T01:27:19.228Z")).toBe("2026-10-20");
    // 11:59 pm is still that day.
    expect(nepalDay("2026-10-20T18:14:00.000Z")).toBe("2026-10-20");
    expect(nepalDay("2026-10-20T18:15:00.000Z")).toBe("2026-10-21");
    // A typed date is that date.
    expect(nepalDay("2026-10-17")).toBe("2026-10-17");
  });

  it("is how the bills page and the weekly and monthly reports count their days", async () => {
    const pos = await read("lib/pos.ts");
    expect(pos).toContain("function currentDateKey() {\n  return nepalDay(new Date());\n}");
    expect(pos).toContain("function invoiceDateKey(value: string) {\n  return nepalDay(value);\n}");
    expect(pos).toContain("return invoiceDateKey(value).slice(0, 7) === currentMonthKey();");
    const period = await read("lib/period-report.ts");
    expect(period).toContain("function dateKeyOf(value: string) {\n  return nepalDay(value);\n}");
  });

  it("lets a code \"ending 17 Oct\" run until midnight in Nepal that night", () => {
    const ends = "2026-10-17T00:00:00.000Z";
    expect(couponHasEnded(ends, new Date("2026-10-17T00:30:00Z"))).toBe(false); // 6:15 am, 17th
    expect(couponHasEnded(ends, new Date("2026-10-17T18:10:00Z"))).toBe(false); // 11:55 pm, 17th
    expect(couponHasEnded(ends, new Date("2026-10-17T18:20:00Z"))).toBe(true); // 12:05 am, 18th
    expect(couponHasEnded(null)).toBe(false);
    const starts = "2026-10-17T00:00:00.000Z";
    expect(couponHasStarted(starts, new Date("2026-10-16T18:20:00Z"))).toBe(true); // 12:05 am, 17th
    expect(couponHasStarted(starts, new Date("2026-10-16T18:10:00Z"))).toBe(false); // 11:55 pm, 16th
  });
});

describe("1 · moving pairs needs a write permission", () => {
  it("sending and receiving a challan ask for operations:write, as 🔢 Count does", async () => {
    const actions = await read("app/admin/stock/actions.ts");
    const send = actions.slice(actions.indexOf("export async function createStockTransferAction"));
    expect(send.slice(0, 700)).toContain('await requireAdminPermission("operations:write");');
    const receive = actions.slice(actions.indexOf("export async function receiveStockTransferAction"));
    expect(receive.slice(0, 400)).toContain('await requireAdminPermission("operations:write");');
    expect(actions).not.toMatch(/StockTransferAction\([^)]*\)[^{]*\{\s*await requireAdminPermission\("stock:read"\)/);
  });

  it("shows the forms only to those who may", async () => {
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain("{open && canCount ? (");
    expect(screen).toContain('"Moving pairs needs the Owner or an Inventory account."');
  });
});

describe("3 · an old backup does not empty the tables it does not carry", () => {
  it("keeps every emptied table whose rows the backup does not hold", () => {
    const emptied = ["products", "users", "factory_worker_photos", "branch_product_stock", "coupons", "admin_sessions"];
    const oldBackup = { shop: { coupons: [] } };
    expect(keptTableNames(emptied, oldBackup, ["products", "users"])).toEqual([
      "factory_worker_photos",
      "branch_product_stock",
      "admin_sessions",
    ]);
    const newBackup = { shop: { coupons: [], branch_product_stock: [], factory_worker_photos: [] } };
    expect(keptTableNames(emptied, newBackup, ["products", "users"])).toEqual(["admin_sessions"]);
  });

  it("reads them before the truncate and puts them back before the commit, or changes nothing", async () => {
    const script = await read("scripts/import-backup-to-postgres.mjs");
    const readAt = script.indexOf("kept = await readKeptTables(client, await tablesTheBackupDoesNotCarry(client, data, truncated));");
    const truncateAt = script.indexOf("await client.query(`TRUNCATE TABLE ${appTables.join(\", \")} RESTART IDENTITY CASCADE`);");
    const backAt = script.indexOf("imported.keptFromBeforeRestore = await putKeptTablesBack(client, kept, allowLoss);");
    const commitAt = script.indexOf('await client.query("COMMIT");', backAt);
    expect(readAt).toBeGreaterThan(0);
    expect(readAt).toBeLessThan(truncateAt);
    expect(backAt).toBeGreaterThan(truncateAt);
    expect(commitAt).toBeGreaterThan(backAt);
    expect(script).toContain("ON CONFLICT DO NOTHING");
    expect(script).toContain("Nothing was changed. Add --allow-losing-kept-rows only if losing them is meant.");
  });
});
