import { beforeEach, describe, expect, it, vi } from "vitest";

const getDataBackendConfig = vi.fn();
const queryPostgres = vi.fn();

vi.mock("@/lib/data-backend", () => ({ getDataBackendConfig }));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres }));

describe("public health route", () => {
  beforeEach(() => {
    vi.resetModules();
    getDataBackendConfig.mockReset();
    queryPostgres.mockReset();
  });

  it("returns ready only after the selected Postgres database answers", async () => {
    getDataBackendConfig.mockReturnValue({
      backend: "postgres",
      isSupported: true,
      hasDatabaseUrl: true,
    });
    queryPostgres.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "ready" });
  });

  it("returns 503 without exposing database errors", async () => {
    getDataBackendConfig.mockReturnValue({
      backend: "postgres",
      isSupported: true,
      hasDatabaseUrl: true,
    });
    queryPostgres.mockRejectedValue(new Error("secret database address"));
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('"database":"unavailable"');
    expect(body).not.toContain("secret database address");
  });
});
