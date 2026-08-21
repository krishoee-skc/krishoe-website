import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSession = vi.fn();
const getAdminStaffAccountById = vi.fn();
const queryPostgres = vi.fn();

vi.mock("@/lib/admin-auth", () => ({ getAdminSession: () => getAdminSession() }));
vi.mock("@/lib/admin-settings", () => ({
  getAdminStaffAccountById: (id: string) => getAdminStaffAccountById(id),
}));
vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: (...args: unknown[]) => queryPostgres(...args),
}));

const { getCurrentWorkerAccess } = await import("@/lib/worker-auth");

function staff(overrides: Record<string, unknown> = {}) {
  return { id: "STAFF-1", status: "Active", factoryWorkerId: "WORKER-1", ...overrides };
}

/** Answers each portal query by looking at the SQL, so call order does not matter. */
function factoryReturns({ worker = [{ id: "WORKER-1", name: "ankus", category: "Upper", worker_type: "piece_rate", status: "active" }], work = [] as unknown[], months = [] as unknown[], balance = "0" } = {}) {
  queryPostgres.mockImplementation(async (_store: string, sql: string) => {
    if (sql.includes("FROM factory_workers")) return worker;
    if (sql.includes("FROM factory_daily_work")) return work;
    if (sql.includes("FROM factory_monthly_summary")) return months;
    if (sql.includes("FROM factory_worker_ledger")) return [{ balance }];
    throw new Error(`unexpected query: ${sql}`);
  });
}

beforeEach(() => {
  getAdminSession.mockReset().mockResolvedValue({ staffId: "STAFF-1" });
  getAdminStaffAccountById.mockReset().mockResolvedValue(staff());
  queryPostgres.mockReset();
});

describe("worker portal access", () => {
  it("requires a sign-in", async () => {
    getAdminSession.mockResolvedValue(null);
    const access = await getCurrentWorkerAccess();
    expect(access.authenticated).toBe(false);
  });

  it("refuses a staff account that is not active", async () => {
    getAdminStaffAccountById.mockResolvedValue(staff({ status: "Disabled" }));
    const access = await getCurrentWorkerAccess();
    expect(access.authenticated).toBe(false);
  });

  // Without a link there is no way to know whose wages to show, and guessing by
  // name is what attributed pay to the wrong person before.
  it("shows nothing until the sign-in is linked to a factory worker", async () => {
    getAdminStaffAccountById.mockResolvedValue(staff({ factoryWorkerId: undefined }));
    const access = await getCurrentWorkerAccess();

    expect(access).toMatchObject({ authenticated: true, linked: false });
    expect(queryPostgres).not.toHaveBeenCalled();
  });

  it("refuses an inactive worker record", async () => {
    factoryReturns({
      worker: [{ id: "WORKER-1", name: "ankus", category: "Upper", worker_type: "piece_rate", status: "inactive" }],
    });
    const access = await getCurrentWorkerAccess();
    expect(access).toMatchObject({ authenticated: true, linked: false });
  });

  it("returns the linked worker's own pairs, months and balance", async () => {
    factoryReturns({
      work: [
        { id: "W1", date: "2026-07-31", item_name: "panja", color: "Black", size: "40", pairs_count: 60, amount_earned: "1500.00", status: "completed" },
      ],
      months: [
        { month: "2026-07-01", total_pairs: 120, total_earned: "3000.00", total_paid: "0.00", final_balance: "3000.00", status: "draft" },
      ],
      balance: "3000.00",
    });

    const access = await getCurrentWorkerAccess();
    if (!access.authenticated || !access.linked) throw new Error("expected a linked worker");

    expect(access.detail.worker.name).toBe("ankus");
    expect(access.detail.work[0]).toMatchObject({ itemName: "panja", pairs: 60, amountEarned: 1500 });
    // The month named the way the worker knows it, not "2026-07". 1 July 2026
    // is still Ashar — Shrawan does not open until the 17th.
    expect(access.detail.months[0]).toMatchObject({ month: "असार २०८३", totalPairs: 120, totalEarned: 3000 });
    expect(access.detail.balance).toBe(3000);
  });

  // The whole portal rests on this: every query is scoped to the linked worker,
  // so one worker can never be shown another's pay.
  it("scopes every query to the linked worker id", async () => {
    factoryReturns();
    await getCurrentWorkerAccess();

    expect(queryPostgres.mock.calls.length).toBeGreaterThan(0);
    for (const [, , params] of queryPostgres.mock.calls) {
      expect(params).toEqual(["WORKER-1"]);
    }
  });
});
