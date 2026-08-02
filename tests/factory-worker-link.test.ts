import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authorizeFactoryApi = vi.fn();
const queryPostgres = vi.fn();
const recordAdminAuditEvent = vi.fn();

vi.mock("@/lib/factory-api-access", () => ({ authorizeFactoryApi }));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent }));

describe("factory worker HR linkage", () => {
  beforeEach(() => {
    authorizeFactoryApi.mockReset().mockResolvedValue(null);
    queryPostgres.mockReset();
    recordAdminAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("links one active HR employee to one factory worker", async () => {
    queryPostgres
      .mockResolvedValueOnce([{ id: "EMP-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "worker-1",
        name: "Ram",
        worker_type: "piece_rate",
        category: "Upper",
        monthly_salary: null,
        weekly_advance: null,
        status: "active",
        hr_employee_id: "EMP-1",
        hr_employee_name: null,
      }]);
    const { PATCH } = await import("@/app/api/factory/workers/route");
    const response = await PATCH(new NextRequest("https://krishoe.test/api/factory/workers", {
      method: "PATCH",
      body: JSON.stringify({ worker_id: "worker-1", hr_employee_id: "EMP-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(queryPostgres.mock.calls[2][1]).toContain("SET hr_employee_id = $2");
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      "factory_worker_hr_link_update",
      expect.stringContaining("Ram"),
    );
  });

  it("rejects an HR employee already linked to another worker", async () => {
    queryPostgres
      .mockResolvedValueOnce([{ id: "EMP-1" }])
      .mockResolvedValueOnce([{ id: "worker-other" }]);
    const { PATCH } = await import("@/app/api/factory/workers/route");
    const response = await PATCH(new NextRequest("https://krishoe.test/api/factory/workers", {
      method: "PATCH",
      body: JSON.stringify({ worker_id: "worker-1", hr_employee_id: "EMP-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("already linked") });
  });
});
