import { beforeEach, describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({
  daily: vi.fn(),
  period: vi.fn(),
  production: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyDailySalesSummary: notifications.daily,
  notifyPeriodSalesSummary: notifications.period,
  notifyProductionSummary: notifications.production,
}));
vi.mock("@/lib/bikram-sambat", () => ({ isBikramMonthStart: () => false }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
// The evening-jobs log and the weekly backup write to the audit trail and the
// file store; a test of who may call the route must not do either.
vi.mock("@/lib/nightly-jobs", () => ({ recordNightlyRun: vi.fn(), alertNightlyFailures: vi.fn() }));
vi.mock("@/lib/scheduled-backup", () => ({
  runScheduledBackup: vi.fn(async () => ({ outcome: "skipped", summary: "Skipped: test." })),
}));
vi.mock("@/lib/staff-idle", () => ({ sweepIdleStaffAccounts: vi.fn(async () => ({ closed: [], warned: [] })) }));
vi.mock("@/lib/review-requests", () => ({ sendReviewRequests: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ pruneOldMonitoringRows: vi.fn() }));

import { GET } from "@/app/api/cron/daily-sales/route";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CRON_SECRET;
  notifications.daily.mockResolvedValue({ deliveryStatus: "sent" });
  notifications.period.mockResolvedValue({ deliveryStatus: "sent" });
  notifications.production.mockResolvedValue({ deliveryStatus: "sent" });
});

describe("cron route authentication", () => {
  it("fails closed when CRON_SECRET is missing", async () => {
    const response = await GET(new Request("https://shop.example/api/cron/daily-sales"));

    expect(response.status).toBe(503);
    expect(notifications.daily).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer token", async () => {
    process.env.CRON_SECRET = "a-long-production-cron-secret";
    const response = await GET(
      new Request("https://shop.example/api/cron/daily-sales", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(notifications.daily).not.toHaveBeenCalled();
  });

  it("runs with the configured bearer token", async () => {
    process.env.CRON_SECRET = "a-long-production-cron-secret";
    const response = await GET(
      new Request("https://shop.example/api/cron/daily-sales", {
        headers: { Authorization: "Bearer a-long-production-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(notifications.daily).toHaveBeenCalledOnce();
    expect(notifications.production).toHaveBeenCalled();
  });
});
