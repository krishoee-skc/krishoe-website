import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryPostgres = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/postgres/client", () => ({
  queryPostgres: (...args: unknown[]) => queryPostgres(...args),
}));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  queryPostgres.mockReset().mockResolvedValue([]);
  reportError.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadLogError() {
  const { logError } = await import("@/lib/monitoring");
  return logError;
}

describe("recording a failure", () => {
  it("stores the fingerprint beside the message", async () => {
    const logError = await loadLogError();

    await logError({ level: "error", message: "post bill INV-1183 failed: timeout" });

    const [, sql, values] = queryPostgres.mock.calls[0] as [string, string, unknown[]];
    expect(sql).toContain("INSERT INTO monitoring_errors");
    expect(sql).toContain("fingerprint");
    expect(values[2]).toBe("post bill INV-1183 failed: timeout");
    expect(values[3]).toBe("post bill <ref> failed: timeout");
  });

  it("caps what one row can hold", async () => {
    const logError = await loadLogError();

    await logError({
      level: "error",
      message: "x".repeat(5000),
      stack: "y".repeat(20000),
    });

    const [, , values] = queryPostgres.mock.calls[0] as [string, string, unknown[]];
    expect((values[2] as string).length).toBeLessThanOrEqual(500);
    expect((values[4] as string).length).toBeLessThanOrEqual(4000);
  });
});

/**
 * The one way an error logger makes an outage worse.
 *
 * When the database is what broke, every request that fails then tries to write
 * a row to the database that is failing — so the shop spends the capacity it
 * has left on writes that cannot land, each waiting out its own connection
 * timeout. And the write is reached from reportError, so a failure reported
 * from in here would call back into the thing that called it.
 */
describe("when the database is the thing that is down", () => {
  it("stops trying after a few refusals in a row", async () => {
    queryPostgres.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const logError = await loadLogError();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await logError({ level: "error", message: `failure ${attempt}` });
    }

    expect(queryPostgres).toHaveBeenCalledTimes(3);
  });

  it("never reports its own failure through reportError", async () => {
    queryPostgres.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const logError = await loadLogError();

    await logError({ level: "error", message: "anything" });

    // reportError calls logError. Reporting from in here is an unbounded loop.
    expect(reportError).not.toHaveBeenCalled();
  });

  it("does not throw into the caller, whose work already committed", async () => {
    queryPostgres.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const logError = await loadLogError();

    await expect(logError({ level: "error", message: "anything" })).resolves.toBeUndefined();
  });
});

/**
 * Nothing writes to these tables on purpose — they fill up when things go
 * wrong — so an unbounded table is a slow leak that only widens on the shop's
 * worst days.
 */
describe("keeping the tables from growing without end", () => {
  it("drops rows older than the window the dashboard can show", async () => {
    const { pruneOldMonitoringRows, MONITORING_RETENTION_DAYS } = await import("@/lib/monitoring");

    await pruneOldMonitoringRows();

    const tables = queryPostgres.mock.calls.map(([, sql]) => String(sql));
    expect(tables.some((sql) => sql.includes("DELETE FROM monitoring_errors"))).toBe(true);
    expect(tables.some((sql) => sql.includes("DELETE FROM monitoring_performance"))).toBe(true);
    expect(tables.some((sql) => sql.includes("DELETE FROM monitoring_uptime"))).toBe(true);
    expect(queryPostgres.mock.calls[0][2]).toEqual([MONITORING_RETENTION_DAYS]);
  });

  it("does not fail the night's summaries when it cannot run", async () => {
    queryPostgres.mockRejectedValue(new Error("Connection terminated unexpectedly"));
    const { pruneOldMonitoringRows } = await import("@/lib/monitoring");

    await expect(pruneOldMonitoringRows()).resolves.toBeUndefined();
  });
});
