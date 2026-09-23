import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDataBackendConfig = vi.fn();
const queryPostgres = vi.fn();

vi.mock("@/lib/data-backend", () => ({ getDataBackendConfig }));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres }));

const postgres = { backend: "postgres", isSupported: true, hasDatabaseUrl: true };
const ask = (query = "") => new NextRequest(`https://krishoe.test/api/health${query}`);

describe("public health route", () => {
  beforeEach(() => {
    vi.resetModules();
    getDataBackendConfig.mockReset();
    queryPostgres.mockReset();
  });

  it("answers an ordinary check without waking the database", async () => {
    getDataBackendConfig.mockReturnValue(postgres);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(ask());

    // Neon bills every wake-up; the outside checker asks dozens of times a day.
    expect(queryPostgres).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "not-checked" });
  });

  it("returns ready on a deep check only after the Postgres database answers", async () => {
    getDataBackendConfig.mockReturnValue(postgres);
    queryPostgres.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(ask("?deep=1"));

    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "ready" });
  });

  it("returns 503 on a deep check without exposing database errors", async () => {
    getDataBackendConfig.mockReturnValue(postgres);
    queryPostgres.mockRejectedValue(new Error("secret database address"));
    const { GET } = await import("@/app/api/health/route");
    const response = await GET(ask("?deep=1"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('"database":"unavailable"');
    expect(body).not.toContain("secret database address");
  });
});
