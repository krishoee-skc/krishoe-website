import { queryPostgres } from "@/lib/postgres/client";
import { sendPushToStaff } from "@/lib/push-notifications";
import { reportError } from "@/lib/report-error";

/**
 * Telling the owner when someone signs in from a phone or computer never used
 * before.
 *
 * A stolen password is silent. Every other protection here — the rate limit,
 * the emailed code, the audit log — either slows an attacker down or records
 * what they did afterwards; none of them tells the owner while it is
 * happening. This does, and it is the one alert where a false alarm costs
 * nothing and a missed one costs the shop.
 *
 * Only a device not seen before raises it. Alerting on every sign-in would mean
 * several notifications a day for the owner's own routine, and an alert that
 * fires constantly is one nobody reads — which is the same as having none.
 */

const STORE = "notifications";

type SeenRow = { seen: number | string };

/**
 * Whether this staff member has signed in from this device before.
 *
 * Matched on the device label rather than the exact user agent: a browser
 * update changes the version string, and treating "Chrome 141" and "Chrome 142"
 * as different machines would alert on every update until nobody looked.
 */
async function isNewDevice(staffId: string, deviceLabel: string, sessionId: string) {
  if (!staffId || !deviceLabel) return false;

  const rows = await queryPostgres<SeenRow>(
    STORE,
    `SELECT count(*)::int AS seen
       FROM admin_staff_sessions
      WHERE staff_id = $1
        AND device_label = $2
        AND id <> $3`,
    [staffId, deviceLabel, sessionId],
  );

  return Number(rows[0]?.seen ?? 0) === 0;
}

/**
 * Raises the alert, if this is a device the account has not used before.
 *
 * Never throws. A sign-in must succeed whether or not anyone could be told
 * about it — locking the owner out of their own shop because a push service was
 * unreachable would be a far worse failure than a missed notification.
 */
export async function alertOnNewDeviceLogin(input: {
  staffId: string;
  staffName: string;
  role: string;
  deviceLabel: string;
  sessionId: string;
  mfaVerified: boolean;
}) {
  try {
    if (!(await isNewDevice(input.staffId, input.deviceLabel, input.sessionId))) {
      return { alerted: false as const };
    }

    await sendPushToStaff({
      title: "नयाँ device बाट login भयो 🔐",
      // Names the account and the machine, because "someone signed in" is not
      // something the owner can act on. Never the IP address: it means nothing
      // to them and would only make the message look like a warning they cannot
      // read.
      body: `${input.staffName} (${input.role}) · ${input.deviceLabel}${
        input.mfaVerified ? "" : " · 2-step बिना"
      }`,
      // Straight to the screen where a session can actually be ended. An alert
      // that cannot be acted on in the same breath is only worry.
      url: "/admin/devices",
      tag: `login-${input.staffId}-${input.sessionId}`,
    });

    return { alerted: true as const };
  } catch (error) {
    reportError("alert on new device login", error);
    return { alerted: false as const };
  }
}
