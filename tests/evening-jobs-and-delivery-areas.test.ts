import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanDeliveryPricing,
  deliveryChargeFor,
  deliveryChargeLine,
  deliveryPolicySentence,
  deliveryPromise,
  STORE_PICKUP,
} from "@/lib/delivery-fee";

const COURIER = "Nationwide courier coordination";
const areas = cleanDeliveryPricing({
  feePaisa: 20_000,
  freeOverPaisa: 200_000,
  zones: [
    { id: "", name: "Inside Chitwan", feePaisa: 0 },
    { id: "", name: "  Kathmandu   valley ", feePaisa: 15_000 },
    { id: "", name: "", feePaisa: 9_900 },
    { id: "", name: "Rest of Nepal", feePaisa: 20_000 },
  ],
});

describe("delivery charged by area", () => {
  it("keeps named areas only, numbered in order, names tidied", () => {
    expect(areas.zones).toEqual([
      { id: "z1", name: "Inside Chitwan", feePaisa: 0 },
      { id: "z2", name: "Kathmandu valley", feePaisa: 15_000 },
      { id: "z3", name: "Rest of Nepal", feePaisa: 20_000 },
    ]);
  });

  it("charges the chosen area, and names it on the order", () => {
    const charge = deliveryChargeFor(areas, COURIER, 100_000, "z2");
    expect(charge).toEqual({ kind: "charged", feePaisa: 15_000, area: "Kathmandu valley" });
    expect(deliveryChargeLine(charge)).toBe("Delivery charge: Rs. 150 (Kathmandu valley)");
  });

  it("an area at 0 is free, and the flat fee no longer applies", () => {
    expect(deliveryChargeFor(areas, COURIER, 100_000, "z1")).toEqual({ kind: "free", feePaisa: 0 });
  });

  it("asks for the area rather than guessing it", () => {
    expect(deliveryChargeFor(areas, COURIER, 100_000, "").kind).toBe("choose-area");
    expect(deliveryChargeFor(areas, COURIER, 100_000, "z9").kind).toBe("choose-area");
  });

  it("free over the threshold and store pickup still win over any area", () => {
    expect(deliveryChargeFor(areas, COURIER, 250_000, "z3")).toEqual({ kind: "free", feePaisa: 0 });
    expect(deliveryChargeFor(areas, STORE_PICKUP, 100_000, "")).toEqual({ kind: "free", feePaisa: 0 });
  });

  it("with no areas, behaves exactly as the flat fee did", () => {
    const flat = cleanDeliveryPricing({ feePaisa: 15_000, freeOverPaisa: 200_000 });
    expect(flat).toEqual({ feePaisa: 15_000, freeOverPaisa: 200_000 });
    expect(deliveryChargeFor(flat, COURIER, 100_000, "z1")).toEqual({ kind: "charged", feePaisa: 15_000 });
  });

  it("tells the assistant and the banner about the areas", () => {
    expect(deliveryPolicySentence(areas)).toContain("Kathmandu valley Rs. 150");
    expect(deliveryPolicySentence(areas)).toContain("Inside Chitwan free");
    const noThreshold = cleanDeliveryPricing({ ...areas, freeOverPaisa: 0 });
    expect(deliveryPromise(noThreshold).en).toBe("Delivery from Rs. 150, by area");
  });

  it("the server refuses a courier order with no area", async () => {
    const actions = await readFile("app/actions.ts", "utf8");
    expect(actions).toContain('return errorState("Please choose your delivery area.");');
    expect(actions).toContain("deliveryZone,");
  });

  it("the migration only adds a defaulted column", async () => {
    const sql = await readFile("scripts/migrations/20260925_delivery_zones.sql", "utf8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS delivery_zones jsonb NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).not.toMatch(/\bDROP\b(?! COLUMN delivery_zones\))|\bUPDATE\b|\bDELETE\b/);
  });
});

// The first import of the backup module pulls in the whole backup builder and
// the file-store client, which on a busy machine can take longer than the
// default five seconds — a slow import, not a slow lock.
describe("the weekly backup is locked", { timeout: 30_000 }, () => {
  it("opens with the key, and not without it", async () => {
    const { openBackup, sealBackup } = await import("@/lib/scheduled-backup");
    const key = randomBytes(32);
    const json = JSON.stringify({ source: "KRISHOE admin backup", note: "नमस्ते 👟" });
    const sealed = sealBackup(json, key);
    expect(sealed.toString("utf8")).not.toContain("KRISHOE admin backup");
    expect(openBackup(sealed, key)).toBe(json);
    expect(() => openBackup(sealed, randomBytes(32))).toThrow();
  });

  it("refuses a file that was altered", async () => {
    const { openBackup, sealBackup } = await import("@/lib/scheduled-backup");
    const key = randomBytes(32);
    const sealed = sealBackup("{}", key);
    sealed[sealed.length - 1] ^= 1;
    expect(() => openBackup(sealed, key)).toThrow();
  });

  it("is skipped, not failed, until the key is set", async () => {
    const { runScheduledBackup } = await import("@/lib/scheduled-backup");
    const saved = process.env.BACKUP_ENCRYPTION_KEY;
    delete process.env.BACKUP_ENCRYPTION_KEY;
    expect((await runScheduledBackup()).outcome).toBe("skipped");
    if (saved !== undefined) process.env.BACKUP_ENCRYPTION_KEY = saved;
  });

  it("downloads only for the Owner, and only a stored name", async () => {
    const route = await readFile("app/api/admin/backups/download/route.ts", "utf8");
    expect(route).toContain('await requireAdminPermission("backup:export")');
    expect(route).toContain("(await listStoredBackups()).find((backup) => backup.pathname === name)");
  });
});

const audit = vi.hoisted(() => ({ record: vi.fn(), latest: vi.fn() }));
const alert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-audit", () => ({
  recordAdminAuditEvent: audit.record,
  getLatestAuditEventsByActionPrefix: audit.latest,
}));
vi.mock("@/lib/owner-security-alert", () => ({ sendOwnerSecurityAlert: alert }));

describe("the evening jobs are written down", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a run as one audit line, a failure as a warning", async () => {
    const { recordNightlyRun } = await import("@/lib/nightly-jobs");
    await recordNightlyRun("daily", "failed", "Not delivered (failed).");
    await recordNightlyRun("weekly-backup", "skipped", "latest is recent");
    expect(audit.record).toHaveBeenNthCalledWith(1, "nightly_daily", "Not delivered (failed).", "warning", expect.anything());
    expect(audit.record).toHaveBeenNthCalledWith(2, "nightly_weekly-backup", "Skipped: latest is recent", "success", expect.anything());
  });

  it("reads each job's latest run back, in the panel's order", async () => {
    audit.latest.mockResolvedValue([
      { action: "nightly_weekly-backup", detail: "Skipped: recent", status: "success", createdAt: "2026-09-25T14:16:00Z" },
      { action: "nightly_daily", detail: "Sent.", status: "success", createdAt: "2026-09-25T14:15:00Z" },
      { action: "nightly_idle-staff", detail: "Failed: boom", status: "warning", createdAt: "2026-09-25T14:15:00Z" },
    ]);
    const { latestNightlyRuns } = await import("@/lib/nightly-jobs");
    const runs = await latestNightlyRuns();
    expect(runs.map((run) => [run.job, run.outcome])).toEqual([
      ["daily", "ok"],
      ["idle-staff", "failed"],
      ["weekly-backup", "skipped"],
    ]);
  });

  it("tells the Owner about a failure, and that 9 pm will retry the 8 pm run", async () => {
    const { alertNightlyFailures } = await import("@/lib/nightly-jobs");
    await alertNightlyFailures([]);
    expect(alert).not.toHaveBeenCalled();
    await alertNightlyFailures(["daily"], new Date("2026-09-25T14:15:00Z")); // 20:00 in Nepal
    expect(alert.mock.calls[0][1]).toContain("tried again at 9 pm");
    await alertNightlyFailures(["daily"], new Date("2026-09-25T15:15:00Z")); // 21:00
    expect(alert.mock.calls[1][1]).toContain("tomorrow evening");
  });

  it("the nightly route records every job and alarms only on real failures", async () => {
    const cron = await readFile("app/api/cron/daily-sales/route.ts", "utf8");
    expect(cron).toContain("await recordNightlyRun(name, outcome, digestSummary(result.value));");
    expect(cron).toContain("await alertNightlyFailures(alarming, now);");
    expect(cron).toContain('name: "weekly-backup"');
  });
});
