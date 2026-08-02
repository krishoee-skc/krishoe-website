import { describe, expect, it } from "vitest";
import { backupFreshnessStatus } from "@/lib/production-readiness";
import type { AdminAuditEvent } from "@/lib/admin-audit";

function backupEvent(createdAt: string): AdminAuditEvent {
  return {
    id: "backup-1",
    createdAt,
    action: "backup_export",
    detail: "Backup exported.",
    status: "success",
    actorId: "owner",
    actorName: "Owner",
    actorEmail: "owner@example.com",
    actorRole: "Owner",
    actorBranchId: "main",
  };
}

describe("backup readiness", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it("warns until a successful backup is recorded", () => {
    expect(backupFreshnessStatus([], now).status).toBe("warning");
  });

  it("accepts a backup no more than seven days old", () => {
    const check = backupFreshnessStatus([backupEvent("2026-07-29T12:00:00.000Z")], now);
    expect(check.status).toBe("ready");
    expect(check.detail).toContain("4 day(s) ago");
  });

  it("warns when the latest backup is stale", () => {
    expect(
      backupFreshnessStatus([backupEvent("2026-07-01T12:00:00.000Z")], now).status,
    ).toBe("warning");
  });
});
