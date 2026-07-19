import { beforeEach, describe, expect, it, vi } from "vitest";

const runWithDataBackend = vi.fn();
const reportError = vi.fn();

// Fail the store the audit writer actually uses, rather than stubbing the
// writer itself — an ESM spy on the module's own export is not seen by a call
// made inside that module, so stubbing there would have tested nothing.
vi.mock("@/lib/data-backend", () => ({
  runWithDataBackend: (...args: unknown[]) => runWithDataBackend(...args),
}));
vi.mock("@/lib/postgres/client", () => ({ queryPostgres: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ getAdminSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/admin-permissions", () => ({ getConfiguredAdminRole: () => "owner" }));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));

import { recordAdminAuditEvent } from "@/lib/admin-audit";

beforeEach(() => {
  runWithDataBackend.mockReset().mockResolvedValue(undefined);
  reportError.mockReset();
});

// Thirty-seven call sites used to write `.catch(() => undefined)` by hand. Two
// rules matter and both were invisible: the audit trail must never turn a saved
// row into a failed save, and a trail that has stopped recording must not do so
// in silence. These pin both.
describe("recording an audit event", () => {
  it("does not throw when the audit store is down", async () => {
    runWithDataBackend.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    await expect(recordAdminAuditEvent("product_upsert", "Saved LH-01.")).resolves.toBeUndefined();
  });

  it("reports the failure rather than swallowing it", async () => {
    runWithDataBackend.mockRejectedValue(new Error("audit store is down"));

    await recordAdminAuditEvent("product_upsert", "Saved LH-01.");

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0]).toContain("product_upsert");
    expect((reportError.mock.calls[0][1] as Error).message).toBe("audit store is down");
  });

  it("stays quiet when the event is recorded", async () => {
    await recordAdminAuditEvent("product_upsert", "Saved LH-01.");

    expect(runWithDataBackend).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });
});
