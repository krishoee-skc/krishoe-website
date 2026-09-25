import { getAdminSettings } from "@/lib/admin-settings";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { sendPushToStaff } from "@/lib/push-notifications";
import { reportError } from "@/lib/report-error";

/**
 * Telling the Owner when the team changes: a new account, a new role, an
 * account closed, a sign-in blocked.
 *
 * This was an email only, in English, to an inbox the owner opens a few times a
 * week — so an account could be made and used before anyone noticed. It now
 * also goes to the phones that have turned notifications on (Settings), in
 * Nepali, the way the new-device sign-in alert already does.
 *
 * Never throws. The change it reports has already happened; a mail server or a
 * push service being down must not turn a saved change into an error screen.
 */

export type OwnerAlertPush = { title: string; body: string; url?: string; tag?: string };

/** The push titles, both languages; the Nepali is what is sent. */
export const ownerAlertTitles = {
  staffCreated: { en: "New staff account", ne: "🔐 नयाँ स्टाफ account बन्यो" },
  accessChanged: { en: "Staff role changed", ne: "🔐 स्टाफको role बदलियो" },
  statusChanged: { en: "Staff account status changed", ne: "🔐 स्टाफ account को अवस्था बदलियो" },
  temporaryPassword: { en: "Temporary password issued", ne: "🔐 नयाँ temporary password दिइयो" },
  idleWarning: { en: "Unused account closes in 3 days", ne: "⏳ नचलाएको account ३ दिनमा बन्द हुँदैछ" },
  idleClosed: { en: "Unused account closed", ne: "⏸ नचलाएको account बन्द भयो" },
  signInBlocked: { en: "Sign-in blocked after wrong passwords", ne: "🔒 गलत password धेरैपटक, login रोकियो" },
} as const;

export async function sendOwnerSecurityAlert(subject: string, message: string, push?: OwnerAlertPush) {
  let emailed = false;
  try {
    const settings = await getAdminSettings();
    const recipients = [...new Set([
      settings.company.email.trim().toLowerCase(),
      ...settings.staff
        .filter((staff) => staff.role === "Owner" && staff.status === "Active")
        .map((staff) => staff.email.trim().toLowerCase()),
    ].filter(Boolean))];

    const results = await Promise.allSettled(
      recipients.map((email) => sendStaffSecurityEmail({
        email,
        subject,
        payload: { email, kind: "security-alert", message },
      })),
    );
    emailed = results.some((result) => result.status === "fulfilled" && result.value.ok);
  } catch (error) {
    reportError("email the owner a security alert", error);
  }

  if (push) {
    try {
      await sendPushToStaff({
        title: push.title,
        body: push.body,
        url: push.url ?? "/admin/settings",
        tag: push.tag,
      });
    } catch (error) {
      reportError("push the owner a security alert", error);
    }
  }

  return emailed;
}
