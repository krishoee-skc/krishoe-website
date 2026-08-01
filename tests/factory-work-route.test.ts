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
vi.mock("@/lib/factory-mutations", () => ({
  createFactoryWork: vi.fn(),
  submissionKeyForFactoryRequest: vi.fn(),
  FactoryMutationError: class FactoryMutationError extends Error {},
}));

const { GET } = await import("@/app/api/factory/work/route");

beforeEach(() => {
  queryPostgres.mockReset();
  authorizeFactoryApi.mockReset().mockResolvedValue(null);
});

describe("Factory work listing", () => {
  it("returns PostgreSQL decimal values as numbers for safe dashboard arithmetic", async () => {
    queryPostgres.mockResolvedValueOnce([
      {
        id: "work-1",
        date: "2026-08-01",
        worker_id: "worker-1",
        item_id: "item-1",
        color: "Black",
        size: "36",
        pairs_count: 60,
        status: "completed",
        rate_applied: "45.00",
        amount_earned: "2700.00",
        worker_name: "Factory Worker",
        item_name: "Ladies Sandal",
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/factory/work?date=2026-08-01"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authorizeFactoryApi).toHaveBeenCalledWith("/api/factory/work", "GET");
    expect(body.works[0]).toMatchObject({
      pairs_count: 60,
      rate_applied: 45,
      amount_earned: 2700,
    });
    expect(typeof body.works[0].amount_earned).toBe("number");
  });
});
