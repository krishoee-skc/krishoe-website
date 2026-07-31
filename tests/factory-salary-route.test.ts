import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPostgres = vi.fn();

vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: (...args: unknown[]) => queryPostgres(...args),
}));

const { GET } = await import("@/app/api/factory/salary/route");

beforeEach(() => {
  queryPostgres.mockReset();
});

describe("factory staff salary summary", () => {
  it("counts salary payments from payment_given and returns numeric totals", async () => {
    queryPostgres.mockImplementation((_store: string, sql: string) => {
      if (sql.includes("FROM factory_workers")) {
        return Promise.resolve([{ id: "staff-1", name: "Factory Staff", monthly_salary: "15000.00" }]);
      }

      if (sql.includes("FROM factory_worker_ledger")) {
        return Promise.resolve([{ total_paid: "3500.50" }]);
      }

      if (sql.includes("FROM factory_weekly_advance")) {
        return Promise.resolve([{ total_advance: "1000.25" }]);
      }

      return Promise.resolve([]);
    });

    const response = await GET(
      new NextRequest("http://localhost/api/factory/salary?workerId=staff-1&month=2026-07"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(queryPostgres.mock.calls[1][1]).toContain("SUM(payment_given)");
    expect(body).toMatchObject({
      worker_id: "staff-1",
      month: "2026-07",
      total_salary: 15000,
      total_paid: 3500.5,
      total_advance: 1000.25,
      remaining_balance: 10499.25,
    });
  });
});
