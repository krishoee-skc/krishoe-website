import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSettings, saveAdminStaffAccount, type SafeAdminStaffAccount } from "@/lib/admin-settings";
import { latestStaffActivity, revokeAllAdminStaffSessions } from "@/lib/admin-staff-security";
import { ownerAlertTitles, sendOwnerSecurityAlert } from "@/lib/owner-security-alert";
import { checkRateLimit, clearRateLimitAttempts, recordRateLimitAttempt } from "@/lib/rate-limit-store";
import { reportError } from "@/lib/report-error";

/**
 * Closing staff and worker accounts nobody has used for thirty days.
 *
 * Someone who left kept a working sign-in until the Owner remembered to close
 * it, and a password that still opens the shop months after its owner has gone
 * is a password someone else may have. So an account unused for thirty days is
 * closed — Disabled, every session signed out — with a warning to the Owner
 * three days before, and the Owner can open it again from Settings in one tap.
 *
 * "Used" is the last time anyone was actually in the account, not the last
 * sign-in: a phone that stays signed in for weeks ("remember this device") is
 * in use every day it is opened. An Owner's own account is never closed this
 * way — that would lock the shop's owner out of it.
 *
 * Thirty days, chosen by the owner over fifteen: fifteen would close most of
 * the factory after the Dashain and Tihar holidays.
 */

export const IDLE_DAYS = 30;
export const IDLE_WARNING_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type ActivityFields = Pick<
  SafeAdminStaffAccount,
  "createdAt" | "updatedAt" | "lastLoginAt" | "invitedAt" | "invitationAcceptedAt" | "passwordChangedAt"
>;

/**
 * The last moment the account was in use or looked after.
 *
 * Includes updatedAt: re-opening a closed account saves it, so an account the
 * Owner has just opened again starts a fresh thirty days instead of being
 * closed by the next night's run.
 */
export function lastActivityAt(staff: ActivityFields, lastSeenAt?: string) {
  const stamps = [
    lastSeenAt,
    staff.lastLoginAt,
    staff.passwordChangedAt,
    staff.invitationAcceptedAt,
    staff.invitedAt,
    staff.updatedAt,
    staff.createdAt,
  ]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
  return stamps.length ? Math.max(...stamps) : NaN;
}

export type IdleStep =
  | { kind: "keep"; daysIdle: number }
  | { kind: "warn"; daysIdle: number }
  | { kind: "close"; daysIdle: number };

/**
 * What an account is due for, from its quiet days alone: a warning from day
 * 27, closing from day 30. Whether the warning has actually gone out — and
 * three days ago — is the sweep's business (sweepIdleStaffAccounts).
 */
export function idleStep(
  staff: Pick<SafeAdminStaffAccount, "role" | "status">,
  lastActivityMs: number,
  nowMs: number,
): IdleStep {
  if (!Number.isFinite(lastActivityMs)) return { kind: "keep", daysIdle: 0 };
  const daysIdle = Math.floor((nowMs - lastActivityMs) / DAY_MS);
  if (staff.role === "Owner") return { kind: "keep", daysIdle };
  if (staff.status !== "Active" && staff.status !== "Invited") return { kind: "keep", daysIdle };
  if (daysIdle >= IDLE_DAYS) return { kind: "close", daysIdle };
  if (daysIdle >= IDLE_DAYS - IDLE_WARNING_DAYS) return { kind: "warn", daysIdle };
  return { kind: "keep", daysIdle };
}

/** Days until the account would be closed, for the staff list; null when it never will be. */
export function daysUntilIdleClose(
  staff: Pick<SafeAdminStaffAccount, "role" | "status">,
  lastActivityMs: number,
  nowMs: number,
) {
  if (staff.role === "Owner" || (staff.status !== "Active" && staff.status !== "Invited")) return null;
  if (!Number.isFinite(lastActivityMs)) return null;
  const daysIdle = Math.floor((nowMs - lastActivityMs) / DAY_MS);
  return Math.max(0, IDLE_DAYS - daysIdle);
}

/**
 * The warning is remembered, and no account is closed until three days after
 * its warning — so the Owner is always told first, even about accounts that
 * were already long unused the night this started, or after a missed night.
 * Two markers: "warned in the last ten days" (do not warn again) and "warned
 * in the last three days" (not yet time to close). Kept in the rate-limit
 * store, which already expires old entries — no new table.
 */
const WARNED_BUCKET = "staff-idle-warned";
const WARNED_WAIT_BUCKET = "staff-idle-warned-wait";
const WARNED_MS = 10 * DAY_MS;
// A little under three days, so a run a few minutes early is not a day late.
const WARNED_WAIT_MS = IDLE_WARNING_DAYS * DAY_MS - 60 * 60 * 1000;

async function marked(bucket: string, key: string, windowMs: number) {
  return (await checkRateLimit({ bucket, key, maxAttempts: 1, windowMs })).limited;
}

/** The nightly run (app/api/cron/daily-sales). Returns what it did. */
export async function sweepIdleStaffAccounts(nowMs = Date.now()) {
  const settings = await getAdminSettings();
  const seen = await latestStaffActivity();
  const closed: string[] = [];
  const warned: string[] = [];

  for (const staff of settings.staff) {
    const step = idleStep(staff, lastActivityAt(staff, seen.get(staff.id)), nowMs);
    if (step.kind === "keep") continue;

    try {
      const alreadyWarned = await marked(WARNED_BUCKET, staff.id, WARNED_MS);
      if (!alreadyWarned) {
        await recordRateLimitAttempt({ bucket: WARNED_BUCKET, key: staff.id, maxAttempts: 1, windowMs: WARNED_MS });
        await recordRateLimitAttempt({ bucket: WARNED_WAIT_BUCKET, key: staff.id, maxAttempts: 1, windowMs: WARNED_WAIT_MS });
        await sendOwnerSecurityAlert(
          "KRISHOE: an unused staff account closes in 3 days",
          `${staff.name} (${staff.role}) has not used KRISHOE for ${step.daysIdle} days. The account closes in ${IDLE_WARNING_DAYS} days unless they sign in.`,
          {
            title: ownerAlertTitles.idleWarning.ne,
            body: `${staff.name} (${staff.role}) · ${step.daysIdle} days`,
            tag: `staff-idle-warn-${staff.id}`,
          },
        );
        warned.push(staff.id);
        continue;
      }
      if (step.kind !== "close" || await marked(WARNED_WAIT_BUCKET, staff.id, WARNED_WAIT_MS)) continue;

      await saveAdminStaffAccount({
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        branchId: staff.branchId,
        employeeId: staff.employeeId,
        status: "Disabled",
        mustChangePassword: staff.mustChangePassword,
        mfaEnabled: staff.mfaEnabled,
        invitationAcceptedAt: staff.invitationAcceptedAt,
      });
      const signedOut = await revokeAllAdminStaffSessions(staff.id, "idle-close");
      await recordAdminAuditEvent(
        "staff_idle_closed",
        `${staff.name} (${staff.role}) was closed after ${step.daysIdle} days without use. ${signedOut} session(s) signed out. The Owner can open it again from Settings.`,
        "warning",
      );
      await sendOwnerSecurityAlert(
        "KRISHOE: an unused staff account was closed",
        `${staff.name} (${staff.role}) had not used KRISHOE for ${step.daysIdle} days and was closed. Open it again from Settings if they still work with you.`,
        {
          title: ownerAlertTitles.idleClosed.ne,
          body: `${staff.name} (${staff.role}) · Settings → Active`,
          tag: `staff-idle-closed-${staff.id}`,
        },
      );
      await clearRateLimitAttempts(WARNED_BUCKET, staff.id);
      closed.push(staff.id);
    } catch (error) {
      reportError(`close idle staff account ${staff.id}`, error);
    }
  }

  return { closed, warned };
}

/** What the staff list shows about each account's use and sign-in. */
export type StaffSafetyView = {
  /** Last time the account was used, ISO; null when nothing is known. */
  lastActiveAt: string | null;
  daysIdle: number | null;
  /** Days before tonight's runs close it; null when it never will be (Owner, already closed). */
  daysLeft: number | null;
  /** Wrong passwords recently enough that sign-in is probably being refused. */
  signInBlocked: boolean;
};

const SIGN_IN_BLOCK_ATTEMPTS = 6;
const SIGN_IN_BLOCK_MS = 15 * 60 * 1000;

export function staffSafetyView(
  staff: SafeAdminStaffAccount,
  lastSeenAt: string | undefined,
  nowMs: number,
): StaffSafetyView {
  const lastMs = lastActivityAt(staff, lastSeenAt);
  const lastFailedMs = staff.lastFailedLoginAt ? new Date(staff.lastFailedLoginAt).getTime() : NaN;
  return {
    lastActiveAt: Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null,
    daysIdle: Number.isFinite(lastMs) ? Math.max(0, Math.floor((nowMs - lastMs) / DAY_MS)) : null,
    daysLeft: daysUntilIdleClose(staff, lastMs, nowMs),
    signInBlocked: staff.failedLoginCount >= SIGN_IN_BLOCK_ATTEMPTS
      && Number.isFinite(lastFailedMs)
      && nowMs - lastFailedMs < SIGN_IN_BLOCK_MS,
  };
}

/** For Settings: one grouped read of the sessions, then plain arithmetic. */
export async function staffSafetyOverview(staff: SafeAdminStaffAccount[]) {
  const seen = await latestStaffActivity();
  const nowMs = Date.now();
  return Object.fromEntries(
    staff.map((member) => [member.id, staffSafetyView(member, seen.get(member.id), nowMs)]),
  ) as Record<string, StaffSafetyView>;
}
