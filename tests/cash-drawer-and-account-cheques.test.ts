import { readFile as readRaw } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { drawerCheck } from "@/lib/cash-days-rules";
import { cashDayMigrations } from "@/lib/cash-days";
import { buildDayBook } from "@/lib/day-book-rules";
import { hubForPath } from "@/app/admin/hubs";

const read = async (path: string) => (await readRaw(path, "utf8")).replace(/\r\n/g, "\n");

/** The drawer check (owner, 2026-10-29, items 3 and 5). */
describe("the drawer check", () => {
  it("says what should be in the drawer, and how far the count is off", () => {
    expect(drawerCheck(5000, 2400, 2700, 4700)).toEqual({ expected: 4700, difference: 0 });
    expect(drawerCheck(5000, 2400, 2700, 4500)).toEqual({ expected: 4700, difference: -200 });
    expect(drawerCheck(5000, 2400, 2700, 4800)).toEqual({ expected: 4700, difference: 100 });
  });

  it("asks for the morning cash before it says anything, and waits for the count", () => {
    expect(drawerCheck(null, 2400, 2700, 4700)).toEqual({ expected: null, difference: null });
    expect(drawerCheck(0, 2400, 0, null)).toEqual({ expected: 2400, difference: null });
  });

  it("adds its table by the Owner's button, word for word from the migration", async () => {
    const migration = cashDayMigrations.find((item) => item.table === "cash_days");
    expect(migration?.sql.replace(/\r\n/g, "\n")).toBe(await read("scripts/migrations/20261029_cash_days.sql"));
    expect(await read("docs/schema.sql")).toContain("CREATE TABLE IF NOT EXISTS cash_days (");
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings).toContain('id="cash-days-database"');
    expect(settings).toContain("<form action={prepareCashDaysDatabaseAction}");
  });

  it("is written by who keeps the counter, and only a day at a time", async () => {
    const actions = await read("app/admin/transactions/actions.ts");
    expect(actions).toContain('export async function recordDrawerAction');
    expect(actions).toContain('requireAdminPermission("pos:write")');
  });
});

/** A cheque taken in Money in goes into the cheque book (item 4). */
describe("a cheque taken on an account", () => {
  it("is filed in the cheque book under its account line", async () => {
    const actions = await read("app/admin/transactions/actions.ts");
    expect(actions).toContain('source: "manual",');
    expect(actions).toContain("sourceId: taken.id,");
    expect(await read("lib/cheque-book.ts")).toContain('input.source === "manual" && !input.sourceId ? id : input.sourceId');
  });

  it("is not counted in the Day Book once it bounces", () => {
    const rows = buildDayBook({
      bills: [],
      purchases: [],
      customerLines: [
        { id: "T1", created_at: "2026-10-29T05:00:00Z", account_id: "L1", name: "Ram Traders", type: "Cheque Payment", amount: 15000, note: "" },
        { id: "T2", created_at: "2026-10-29T06:00:00Z", account_id: "L2", name: "Hari", type: "Cheque Payment", amount: 2000, note: "" },
      ],
      supplierLines: [],
      wages: [],
      cheques: [{ source: "manual", source_id: "T1", state: "bounced" }],
      billLedgerLineIds: [],
      purchaseSupplierLineIds: [],
    });
    expect(rows.find((r) => r.id === "customer:T1")).toMatchObject({ bounced: true, moneyIn: 0 });
    expect(rows.find((r) => r.id === "customer:T2")).toMatchObject({ bounced: false, moneyIn: 2000 });
  });
});

/** A customer's account is under Money in the menu (item 2). */
describe("the menu name a customer's account sits under", () => {
  it("is Money, not Factory", () => {
    expect(hubForPath("/admin/operations/ledger/CL-1")).toBe("money");
    expect(hubForPath("/admin/operations")).toBe("factory");
  });
});
