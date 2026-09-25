import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("@/lib/admin-settings", () => ({ getAdminSettings: vi.fn(), saveAdminStaffAccount: vi.fn() }));
vi.mock("@/lib/admin-staff-security", () => ({ latestStaffActivity: vi.fn(), revokeAllAdminStaffSessions: vi.fn() }));
const store = new Map<string, number>();
vi.mock("@/lib/rate-limit-store", () => ({
  checkRateLimit: vi.fn(async ({ bucket, key, windowMs }: { bucket: string; key: string; windowMs: number }) => {
    const at = store.get(`${bucket}:${key}`);
    return { limited: at !== undefined && clock.now - at < windowMs };
  }),
  recordRateLimitAttempt: vi.fn(async ({ bucket, key }: { bucket: string; key: string }) => { store.set(`${bucket}:${key}`, clock.now); }),
  clearRateLimitAttempts: vi.fn(async (bucket: string, key: string) => { store.delete(`${bucket}:${key}`); }),
}));
const clock = vi.hoisted(() => ({ now: 0 }));
vi.mock("@/lib/owner-security-alert", () => ({
  ownerAlertTitles: { idleWarning: { ne: "w" }, idleClosed: { ne: "c" } },
  sendOwnerSecurityAlert: vi.fn(),
}));

const { IDLE_DAYS, idleStep, lastActivityAt, staffSafetyView, sweepIdleStaffAccounts } = await import("@/lib/staff-idle");
const settingsModule = await import("@/lib/admin-settings");
const securityModule = await import("@/lib/admin-staff-security");
const { generateTemporaryPassword, temporaryPasswordProblem } = await import("@/lib/temporary-password");

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-25T06:00:00Z");
const worker = { role: "Worker", status: "Active" } as const;

/**
 * Four safety changes to staff and worker accounts, chosen by the owner:
 * the Owner hears about changes on the phone, temporary passwords are strong,
 * accounts nobody uses close after thirty days, and a blocked sign-in can be
 * unlocked by the Owner.
 */

describe("accounts nobody uses close after thirty days", () => {
  it("keeps an account used within the month", () => {
    expect(idleStep(worker, now - 10 * DAY, now).kind).toBe("keep");
  });

  it("is due a warning from three days before", () => {
    expect(idleStep(worker, now - 26 * DAY, now).kind).toBe("keep");
    expect(idleStep(worker, now - 27 * DAY, now).kind).toBe("warn");
    expect(idleStep(worker, now - 29 * DAY, now).kind).toBe("warn");
  });

  it("closes it at thirty days, and later if a night was missed", () => {
    expect(IDLE_DAYS).toBe(30);
    expect(idleStep(worker, now - 30 * DAY, now).kind).toBe("close");
    expect(idleStep(worker, now - 45 * DAY, now).kind).toBe("close");
  });

  it("never closes the Owner, or an account already closed", () => {
    expect(idleStep({ role: "Owner", status: "Active" }, now - 90 * DAY, now).kind).toBe("keep");
    expect(idleStep({ role: "Worker", status: "Disabled" }, now - 90 * DAY, now).kind).toBe("keep");
  });

  it("counts a phone that stays signed in as use", () => {
    const account = { createdAt: new Date(now - 200 * DAY).toISOString(), updatedAt: new Date(now - 200 * DAY).toISOString() };
    const seen = new Date(now - 2 * DAY).toISOString();
    expect(lastActivityAt(account, seen)).toBe(now - 2 * DAY);
  });

  it("gives a re-opened account a fresh month", () => {
    const account = { createdAt: new Date(now - 200 * DAY).toISOString(), updatedAt: new Date(now - DAY).toISOString() };
    expect(idleStep(worker, lastActivityAt(account), now).kind).toBe("keep");
  });

  it("always warns first, and closes three days after the warning", async () => {
    const start = now;
    const longQuiet = {
      id: "w1", name: "Hari", role: "Worker", status: "Active",
      createdAt: new Date(start - 60 * DAY).toISOString(), updatedAt: new Date(start - 60 * DAY).toISOString(),
    };
    vi.mocked(settingsModule.getAdminSettings).mockResolvedValue({ staff: [longQuiet] } as never);
    vi.mocked(securityModule.latestStaffActivity).mockResolvedValue(new Map());
    vi.mocked(securityModule.revokeAllAdminStaffSessions).mockResolvedValue(0 as never);
    const night = async (day: number) => { clock.now = start + day * DAY; return sweepIdleStaffAccounts(clock.now); };
    // Sixty days quiet on the first night: warned, not closed.
    expect(await night(0)).toEqual({ closed: [], warned: ["w1"] });
    expect(await night(1)).toEqual({ closed: [], warned: [] });
    expect(await night(2)).toEqual({ closed: [], warned: [] });
    expect(await night(3)).toEqual({ closed: ["w1"], warned: [] });
    expect(settingsModule.saveAdminStaffAccount).toHaveBeenCalledWith(expect.objectContaining({ id: "w1", status: "Disabled" }));
  });

  it("runs every night with the daily jobs", async () => {
    const cron = await readFile("app/api/cron/daily-sales/route.ts", "utf8");
    expect(cron).toContain('name: "idle-staff"');
    expect(cron).toContain("await sweepIdleStaffAccounts()");
  });
});

describe("temporary passwords are strong", () => {
  it("makes two words and four digits, which pass the password rules", () => {
    for (let index = 0; index < 50; index += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
      expect(temporaryPasswordProblem(password, "Ram Bahadur")).toBe("");
    }
  });

  it("refuses short ones and the person's own name", () => {
    expect(temporaryPasswordProblem("ram12345", "Ram")).not.toBe("");
    expect(temporaryPasswordProblem("Ramesh-Kumar-2026", "Ramesh Thapa")).toContain("name");
  });

  it("is checked on the server and offered by a 🎲 button", async () => {
    const actions = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(actions.match(/temporaryPasswordProblem\(/g)?.length).toBeGreaterThanOrEqual(2);
    const field = await readFile("components/admin/TemporaryPasswordField.tsx", "utf8");
    expect(field).toContain("generateTemporaryPassword()");
    expect(field).toContain("minLength={12}");
  });
});

describe("the Owner can unlock a blocked sign-in", () => {
  it("shows the block while it lasts", () => {
    const base = {
      createdAt: new Date(now - DAY).toISOString(),
      updatedAt: new Date(now - DAY).toISOString(),
      role: "Worker",
      status: "Active",
      failedLoginCount: 6,
    } as never;
    const recent = { ...(base as object), lastFailedLoginAt: new Date(now - 5 * 60 * 1000).toISOString() } as never;
    const old = { ...(base as object), lastFailedLoginAt: new Date(now - 60 * 60 * 1000).toISOString() } as never;
    expect(staffSafetyView(recent, undefined, now).signInBlocked).toBe(true);
    expect(staffSafetyView(old, undefined, now).signInBlocked).toBe(false);
  });

  it("lets an unlocked account past the address limit", async () => {
    const login = await readFile("app/admin/login/actions.ts", "utf8");
    expect(login).toContain("hasAccountLoginUnlock(email)");
    expect(login).toContain("rateLimit.limited && !unlockedByOwner");
    const manager = await readFile("components/admin/StaffAccessManager.tsx", "utf8");
    expect(manager).toContain("action={unlockStaffLoginAction}");
  });
});

describe("the Owner hears about staff changes on the phone", () => {
  it("pushes as well as emailing", async () => {
    const alert = await readFile("lib/owner-security-alert.ts", "utf8");
    expect(alert).toContain("sendPushToStaff(");
    const actions = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(actions.match(/ownerAlertTitles\./g)?.length).toBeGreaterThanOrEqual(4);
  });
});
