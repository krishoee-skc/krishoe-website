import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authorizeFactoryApi = vi.fn();
const queryPostgres = vi.fn();
const transactionPostgres = vi.fn();
const recordAdminAuditEvent = vi.fn();

vi.mock("@/lib/factory-api-access", () => ({ authorizeFactoryApi }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent }));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres, transactionPostgres }));

describe("Factory and Production wage rate synchronization", () => {
  beforeEach(() => {
    authorizeFactoryApi.mockReset().mockResolvedValue(null);
    queryPostgres.mockReset();
    transactionPostgres.mockReset();
    recordAdminAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("reads worker override, Production stage, then legacy Factory rate in that order", async () => {
    queryPostgres.mockResolvedValue([{ rate_per_pair: 18, rate_source: "Worker override" }]);
    const { GET } = await import("@/app/api/factory/rates/route");
    const response = await GET(new NextRequest(
      "https://krishoe.test/api/factory/rates?itemId=factory-1&workerCategory=Fiber%20Silai&workerId=worker-1",
    ));

    expect(response.status).toBe(200);
    const sql = String(queryPostgres.mock.calls[0][1]);
    expect(sql).toContain("production_worker_stage_rates");
    expect(sql).toContain("production_stage_rates");
    expect(sql).toContain("factory_rates");
    expect(sql).toContain("ORDER BY priority");
    expect(queryPostgres.mock.calls[0][2]).toEqual([
      "factory-1",
      "Fiber Silai",
      "worker-1",
      "Fiber Silai",
    ]);
  });

  it("saves a linked Factory rate and Production stage rate in one transaction", async () => {
    const dbQuery = vi.fn()
      .mockResolvedValueOnce([{ production_item_id: "production-1" }])
      .mockResolvedValueOnce([{
        id: "rate-1",
        item_id: "factory-1",
        worker_category: "Upper",
        rate_per_pair: 15,
        effective_date: "2026-08-02",
      }])
      .mockResolvedValueOnce([]);
    transactionPostgres.mockImplementation(async (_store, callback) => callback({ query: dbQuery }));
    const { POST } = await import("@/app/api/factory/rates/route");
    const response = await POST(new NextRequest("https://krishoe.test/api/factory/rates", {
      method: "POST",
      body: JSON.stringify({ item_id: "factory-1", worker_category: "Upper", rate_per_pair: 15 }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(201);
    expect(String(dbQuery.mock.calls[1][0])).toContain("INSERT INTO factory_rates");
    expect(String(dbQuery.mock.calls[2][0])).toContain("INSERT INTO production_stage_rates");
    expect(dbQuery.mock.calls[2][1]).toEqual([
      expect.any(String),
      "production-1",
      "Upper",
      15,
    ]);
  });
});
