import { getLatestAuditEventsByActionPrefix, recordAdminAuditEvent } from "@/lib/admin-audit";
import { sendOwnerSecurityAlert } from "@/lib/owner-security-alert";

/**
 * What the evening jobs did, where the owner can see it.
 *
 * The jobs ran — the sales email, the review requests, closing unused staff
 * accounts, the weekly backup — and said nothing to anyone. A failure went to
 * a log the owner never opens, so a week of missing reports looked the same
 * as a week of quiet ones. Each job now leaves one line in the audit trail per
 * run ("nightly_<job>"), Admin → Notifications shows the latest of each, and a
 * failure reaches the Owner's phone the same evening.
 */

export const NIGHTLY_PREFIX = "nightly_";

export type NightlyOutcome = "ok" | "skipped" | "failed";

/** The jobs, in the order the panel lists them, with names the owner reads. */
export const nightlyJobLabels: Record<string, { en: string; ne: string }> = {
  daily: { en: "Daily sales report", ne: "दैनिक बिक्री रिपोर्ट" },
  "daily-production": { en: "Daily production report", ne: "दैनिक उत्पादन रिपोर्ट" },
  "review-requests": { en: "Review requests", ne: "Review अनुरोध" },
  "idle-staff": { en: "Unused staff accounts", ne: "नचलाएका staff account" },
  "weekly-backup": { en: "Weekly backup", ne: "साप्ताहिक backup" },
  weekly: { en: "Weekly sales report", ne: "साप्ताहिक बिक्री रिपोर्ट" },
  "weekly-production": { en: "Weekly production report", ne: "साप्ताहिक उत्पादन रिपोर्ट" },
  monthly: { en: "Monthly sales report", ne: "मासिक बिक्री रिपोर्ट" },
  "monthly-production": { en: "Monthly production report", ne: "मासिक उत्पादन रिपोर्ट" },
};

const SYSTEM_ACTOR = { actorName: "Nightly jobs", actorRole: "System" };

/** The phone alert's words, both languages; the Nepali is what is sent. */
const failureAlert = {
  title: { en: "❌ An evening job failed", ne: "❌ रातको काम असफल भयो" },
  retry: { en: " · retried at 9 pm", ne: " · राति ९ बजे फेरि प्रयास हुन्छ" },
};

/** A skipped run is written as success with a "Skipped:" detail. */
export function outcomeOf(event: { status: "success" | "warning"; detail: string }): NightlyOutcome {
  if (event.status === "warning") return "failed";
  return event.detail.startsWith("Skipped") ? "skipped" : "ok";
}

export async function recordNightlyRun(job: string, outcome: NightlyOutcome, summary: string) {
  const detail = outcome === "skipped" && !summary.startsWith("Skipped") ? `Skipped: ${summary}` : summary;
  await recordAdminAuditEvent(
    `${NIGHTLY_PREFIX}${job}`,
    detail.slice(0, 500),
    outcome === "failed" ? "warning" : "success",
    SYSTEM_ACTOR,
  );
}

export type NightlyRun = {
  job: string;
  label: { en: string; ne: string };
  outcome: NightlyOutcome;
  detail: string;
  at: string;
};

/** Each job's latest run from the last two weeks, in the panel's order. */
export async function latestNightlyRuns(): Promise<NightlyRun[]> {
  const events = await getLatestAuditEventsByActionPrefix(NIGHTLY_PREFIX, 14);
  const order = Object.keys(nightlyJobLabels);
  return events
    .map((event) => {
      const job = event.action.slice(NIGHTLY_PREFIX.length);
      return {
        job,
        label: nightlyJobLabels[job] ?? { en: job, ne: job },
        outcome: outcomeOf(event),
        detail: event.detail,
        at: event.createdAt,
      };
    })
    .sort((left, right) => {
      const a = order.indexOf(left.job);
      const b = order.indexOf(right.job);
      return (a === -1 ? order.length : a) - (b === -1 ? order.length : b);
    });
}

/** Nepal's hour right now, 0–23. */
function nepalHour(now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

/**
 * Tells the Owner, by phone and email, which jobs failed tonight. The 8 pm run
 * is retried at 9 pm (daily-sales-backup), so the first message says so; only
 * the 9 pm one says nothing more will be tried.
 */
export async function alertNightlyFailures(failed: string[], now = new Date()) {
  if (!failed.length) return;
  const names = failed.map((job) => nightlyJobLabels[job]?.ne ?? job).join(", ");
  const retry = nepalHour(now) < 21;
  await sendOwnerSecurityAlert(
    "KRISHOE: an evening job failed",
    `These evening jobs failed: ${failed.map((job) => nightlyJobLabels[job]?.en ?? job).join(", ")}. ${
      retry ? "They will be tried again at 9 pm." : "They will run again tomorrow evening."
    } Details: Admin → Notifications → Evening jobs.`,
    {
      title: failureAlert.title.ne,
      body: `${names}${retry ? failureAlert.retry.ne : ""}`,
      url: "/admin/notifications#evening-jobs",
      tag: "nightly-failed",
    },
  );
}
