import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authorizeFactoryApi = vi.fn();
const queryPostgres = vi.fn();
const recordAdminAuditEvent = vi.fn();

vi.mock("@/lib/factory-api-access", () => ({ authorizeFactoryApi }));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent }));

describe("Factory Item to Production Item linkage", () => {
  beforeEach(() => {
    authorizeFactoryApi.mockReset().mockResolvedValue(null);
    queryPostgres.mockReset();
    recordAdminAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("links one active Production Item to one Factory Item", async () => {
    queryPostgres
      .mockResolvedValueOnce([{ id: "production-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "factory-1",
        name: "Ladies Heel",
        code: null,
        status: "active",
        production_item_id: "production-1",
        production_item_name: null,
      }]);
    const { PATCH } = await import("@/app/api/factory/items/route");
    const response = await PATCH(new NextRequest("https://krishoe.test/api/factory/items", {
      method: "PATCH",
      body: JSON.stringify({ item_id: "factory-1", production_item_id: "production-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(queryPostgres.mock.calls[2][1]).toContain("SET production_item_id = $2");
    expect(recordAdminAuditEvent).toHaveBeenCalledWith(
      "factory_item_production_link_update",
      expect.stringContaining("Ladies Heel"),
    );
  });

  it("rejects a Production Item already linked elsewhere", async () => {
    queryPostgres
      .mockResolvedValueOnce([{ id: "production-1" }])
      .mockResolvedValueOnce([{ id: "factory-other" }]);
    const { PATCH } = await import("@/app/api/factory/items/route");
    const response = await PATCH(new NextRequest("https://krishoe.test/api/factory/items", {
      method: "PATCH",
      body: JSON.stringify({ item_id: "factory-1", production_item_id: "production-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("already linked") });
  });
});
