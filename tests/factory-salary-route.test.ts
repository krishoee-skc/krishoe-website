import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPostgres = vi.fn();
const authorizeFactoryApi = vi.fn();

vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: (...args: unknown[]) => queryPostgres(...args),
}));
vi.mock("@/lib/factory-api-access", () => ({
  authorizeFactoryApi: (...args: unknown[]) => authorizeFactoryApi(...args),
}));

const { GET } = await import("@/app/api/factory/salary/route");

beforeEach(() => {
  queryPostgres.mockReset();
  authorizeFactoryApi.mockReset().mockResolvedValue(null);
});

describe("factory staff salary summary", () => {
  it("counts salary payments from payment_given and returns numeric totals", async () => {
    queryPostgres.mockImplementation((_store: string, sql: string) => {
      if (sql.includes("FROM factory_workers")) {
        return Promise.resolve([{
          id: "staff-1",
          name: "Factory Staff",
          monthly_salary: "15000.00",
          worker_type: "monthly_staff",
        }]);
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
    expect(authorizeFactoryApi).toHaveBeenCalledWith("/api/factory/salary", "GET");
    expect(queryPostgres.mock.calls[1][1]).toContain("SUM(payment_given)");
    expect(queryPostgres.mock.calls[1][1]).toContain("salary_period_month");
    expect(body).toMatchObject({
      worker_id: "staff-1",
      month: "2026-07",
      total_salary: 15000,
      total_paid: 3500.5,
      total_advance: 1000.25,
      remaining_balance: 10499.25,
    });
  });

  it("rejects an invalid month instead of silently using the current month", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/factory/salary?workerId=staff-1&month=2026-99"),
    );

    expect(response.status).toBe(400);
    expect(queryPostgres).not.toHaveBeenCalled();
  });

  it("routes daily staff to HR instead of calculating a false monthly balance", async () => {
    queryPostgres.mockResolvedValueOnce([{
      id: "daily-1",
      name: "Daily Staff",
      monthly_salary: "0",
      worker_type: "daily_staff",
    }]);

    const response = await GET(
      new NextRequest("http://localhost/api/factory/salary?workerId=daily-1&month=2026-08"),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Factory salary is for monthly staff; use HR payroll for daily staff",
    });
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });
});
