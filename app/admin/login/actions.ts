"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getConfiguredAdminRole } from "@/lib/admin-permissions";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import { clearAdminSessionCookie, getAdminSession, setAdminSessionCookie } from "@/lib/admin-auth";
import {
  getAdminStaffAccountById,
  markAdminStaffLogin,
  recordAdminStaffFailedLogin,
  verifyAdminStaffCredentials,
  type SafeAdminStaffAccount,
} from "@/lib/admin-settings";
import {
  createAdminSessionToken,
  sessionMaxAge,
} from "@/lib/admin-session";
import {
  createAdminStaffSession,
  createAdminStaffToken,
  getValidAdminStaffToken,
  revokeAdminStaffSession,
  verifyAdminStaffMfaCode,
} from "@/lib/admin-staff-security";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { constantTimeEqual } from "@/lib/session-security";
import { isAdminBootstrapLoginAllowed } from "@/lib/admin-bootstrap-login";
import { alertOnNewDeviceLogin } from "@/lib/login-alerts";
import { getSiteUrl } from "@/lib/seo";

export type LoginState = {
  ok: boolean;
  message: string;
  requiresMfa?: boolean;
  challengeToken?: string;
  emailHint?: string;
  nextPath?: string;
  // Carried across the two-step round trip, because the box is ticked on the
  // first screen and the session is not created until after the second.
  remember?: boolean;
};

const invalidState: LoginState = {
  ok: false,
  message: "Wrong email/mobile number or password.",
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function shortDelay() {
  await new Promise((resolve) => {
    setTimeout(resolve, 650);
  });
}

async function loginKey() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const userAgent = headerStore.get("user-agent")?.slice(0, 80) ?? "unknown";

  return forwardedFor || realIp || `local:${userAgent}`;
}

async function loginRequestContext() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();

  return {
    ipAddress: forwardedFor || realIp || "",
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? "",
  };
}

function emailHint(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

async function completeStaffLogin(
  staff: SafeAdminStaffAccount,
  mfaVerified: boolean,
  context: Awaited<ReturnType<typeof loginRequestContext>>,
  remember = false,
) {
  const markedStaff = await markAdminStaffLogin(staff.id, context);
  if (!markedStaff) return invalidState;

  // One lifetime for the record, the token and the cookie. Three reads of the
  // same figure would drift the day one of them learned about the tick box and
  // the others did not, leaving a cookie outliving the session behind it.
  const maxAge = sessionMaxAge(remember);
  const sessionRecord = await createAdminStaffSession({
    staffId: markedStaff.id,
    expiresInSeconds: maxAge,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    mfaVerified,
  });
  await setAdminSessionCookie(
    await createAdminSessionToken(
      {
        staffId: markedStaff.id,
        name: markedStaff.name,
        email: markedStaff.email,
        role: markedStaff.role,
        branchId: markedStaff.branchId,
        sessionId: sessionRecord.id,
        mustChangePassword: markedStaff.mustChangePassword,
        mfaVerified,
      },
      maxAge,
    ),
  );
  await recordAdminAuditEvent(
    "login_success",
    `Staff ${markedStaff.name} signed in with ${markedStaff.role} role${mfaVerified ? " and MFA" : ""}.`,
    "success",
    {
      actorId: markedStaff.id,
      actorName: markedStaff.name,
      actorEmail: markedStaff.email,
      actorRole: markedStaff.role,
      actorBranchId: markedStaff.branchId,
    },
  );

  // A stolen password is silent. The audit entry above records this sign-in,
  // but only for someone who later goes looking; this tells the owner while it
  // is happening, and only for a device the account has never used — an alert
  // that fires on every routine sign-in is one nobody reads.
  await alertOnNewDeviceLogin({
    staffId: markedStaff.id,
    staffName: markedStaff.name,
    role: markedStaff.role,
    deviceLabel: sessionRecord.deviceLabel,
    sessionId: sessionRecord.id,
    mfaVerified,
  });

  return {
    ok: true,
    message: "Login successful. Redirecting...",
    nextPath: markedStaff.mustChangePassword ? "/admin/change-password" : undefined,
  } satisfies LoginState;
}

/**
 * Signs in an account whose passkey has already been verified.
 *
 * Deliberately the same `completeStaffLogin` a password sign-in uses, so a
 * passkey login is recorded, alerted on and session-tracked identically. A
 * second path that "also logs someone in" is how two paths drift until one of
 * them stops writing an audit entry.
 *
 * Counted as MFA-verified: the passkey already proves possession of the device
 * plus a fingerprint or PIN, which is a stronger pair than a password and a
 * code sent to an inbox that same password might open.
 */
export async function completePasskeyStaffLogin(staff: SafeAdminStaffAccount) {
  if (staff.status !== "Active") {
    return { ok: false, message: "यो खाता बन्द छ। मालिकलाई भन्नुहोस्।" } satisfies LoginState;
  }

  const context = await loginRequestContext();
  await clearLoginRateLimit(await loginKey());
  return completeStaffLogin(staff, true, context);
}

/**
 * Send a fresh two-step code, and say in the email that it replaces the last.
 *
 * Issuing a code deletes the account's previous unused one — which is right,
 * and was invisible. The owner asked for another code twice while trying to
 * sign in on their phone, so three arrived; the first two were already dead,
 * and nothing in the inbox or on screen said which of the three to type. They
 * spent eleven minutes in that loop.
 *
 * The time is stamped in Nepal time because that is the only way to tell three
 * near-identical emails apart on a phone, where they stack newest-last in a
 * thread as often as newest-first.
 */
async function issueMfaChallenge(email: string, staffId: string) {
  const challenge = await createAdminStaffToken(staffId, "mfa_login", {
    expiresInMinutes: 10,
    withCode: true,
  });

  const sentAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const link = `${getSiteUrl()}/admin/login/link?t=${encodeURIComponent(challenge.token)}&c=${encodeURIComponent(challenge.code)}`;

  const delivery = await sendStaffSecurityEmail({
    email,
    subject: `KRISHOE admin code ${challenge.code} — sent ${sentAt}`,
    payload: {
      email,
      kind: "mfa",
      message:
        `Your one-time KRISHOE admin security code is ${challenge.code}.

` +
        `On a phone, open this instead of typing it:
${link}

` +
        `Sent at ${sentAt} Nepal time. If more than one code is in your inbox, only this newest one works — asking for a code cancels the one before it.

` +
        `Do not share this code or this link.`,
      expiresAt: challenge.expiresAt,
    },
  });

  return { challenge, delivery };
}

/**
 * Another code, without making anyone type their password again.
 *
 * The two-step screen offered only "Start sign-in again", which threw the
 * person back to the password field — and the code that arrived from there
 * killed the one they were still holding. Safe to do from the challenge alone:
 * a live mfa_login token is proof the password was already accepted minutes ago.
 */
export async function resendAdminMfaCodeAction(
  challengeToken: string,
  remember = false,
): Promise<LoginState> {
  const existing = await getValidAdminStaffToken(challengeToken.trim(), "mfa_login");

  if (!existing) {
    return { ok: false, message: "पुरानो प्रयास सकियो। फेरि सुरुबाट login गर्नुहोस्।" };
  }

  const staff = await getAdminStaffAccountById(existing.staffId);

  if (!staff || staff.status !== "Active" || !staff.mfaEnabled) {
    return { ok: false, message: "This staff account cannot complete sign in." };
  }

  const { challenge, delivery } = await issueMfaChallenge(staff.email, staff.id);

  if (!delivery.ok) {
    await recordAdminAuditEvent(
      "login_mfa_delivery_failed",
      `Could not deliver MFA code for ${staff.email}: ${delivery.error}`,
      "warning",
      { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
    );
    return { ok: false, message: "Security code could not be sent. Ask the Owner to check email delivery." };
  }

  await recordAdminAuditEvent(
    "login_mfa_resent",
    `New MFA code sent for ${staff.email}; the previous code is now void.`,
    "success",
    { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
  );

  return {
    ok: false,
    message: "नयाँ कोड पठाइयो। पुराना कोड अब चल्दैनन् — email को सबैभन्दा नयाँ कोड हाल्नुहोस्।",
    requiresMfa: true,
    challengeToken: challenge.token,
    emailHint: emailHint(staff.email),
    remember,
  };
}

export async function loginAdminAction(_previousState: LoginState, formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const remember = formData.get("remember") === "on";
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const key = await loginKey();
  const rateLimit = await checkLoginRateLimit(key);
  const requestContext = await loginRequestContext();

  if (!sessionSecret) {
    return {
      ok: false,
      message: "Admin session secret is not configured.",
    };
  }

  if (rateLimit.limited) {
    await recordAdminAuditEvent(
      "login_rate_limited",
      `Admin login blocked for ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
      "warning",
      email ? { actorEmail: email } : { actorName: "Bootstrap admin", actorRole: getConfiguredAdminRole() },
    );
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  if (email) {
    const staff = await verifyAdminStaffCredentials(email, password);

    if (!staff) {
      await recordAdminStaffFailedLogin(email);
      await recordFailedLogin(key);
      await recordAdminAuditEvent(
        "login_failed",
        `Invalid staff login attempt for ${email}.`,
        "warning",
        { actorEmail: email },
      );
      await shortDelay();
      return invalidState;
    }

    if (staff.mfaEnabled) {
      const { challenge, delivery } = await issueMfaChallenge(staff.email, staff.id);

      if (!delivery.ok) {
        await recordAdminAuditEvent(
          "login_mfa_delivery_failed",
          `Could not deliver MFA code for ${staff.email}: ${delivery.error}`,
          "warning",
          { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
        );
        return { ok: false, message: "Security code could not be sent. Ask the Owner to check email delivery." };
      }

      await recordAdminAuditEvent(
        "login_mfa_challenge",
        `MFA challenge sent for ${staff.email}.`,
        "success",
        { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
      );
      return {
        ok: false,
        message: "Enter the 6-digit code sent to your email.",
        requiresMfa: true,
        challengeToken: challenge.token,
        emailHint: emailHint(staff.email),
        remember,
      };
    }

    await clearLoginRateLimit(key);
    return completeStaffLogin(staff, false, requestContext, remember);
  }

  if (!(await isAdminBootstrapLoginAllowed())) {
    await recordAdminAuditEvent(
      "bootstrap_login_blocked",
      "Blank-email bootstrap login was blocked because active Owner staff accounts exist.",
      "warning",
      { actorName: "Bootstrap admin", actorRole: getConfiguredAdminRole() },
    );
    return {
      ok: false,
      message: "Enter your staff email or mobile number.",
    };
  }

  if (!expectedPassword) {
    return {
      ok: false,
      message: "Admin password is not configured. Use a staff account or set ADMIN_PASSWORD.",
    };
  }

  if (!constantTimeEqual(password, expectedPassword)) {
    await recordFailedLogin(key);
    await recordAdminAuditEvent(
      "login_failed",
      "Invalid admin password attempt.",
      "warning",
      { actorName: "Bootstrap admin", actorRole: getConfiguredAdminRole() },
    );
    await shortDelay();
    return invalidState;
  }

  await clearLoginRateLimit(key);
  await setAdminSessionCookie(await createAdminSessionToken());
  await recordAdminAuditEvent(
    "login_success",
    "Admin session created.",
    "success",
    { actorName: "Bootstrap admin", actorRole: getConfiguredAdminRole() },
  );

  return { ok: true, message: "Login successful. Redirecting..." };
}

export async function verifyAdminMfaAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const challengeToken = textValue(formData, "challengeToken");
  const code = textValue(formData, "code");
  const remember = formData.get("remember") === "on";
  const verification = await verifyAdminStaffMfaCode(challengeToken, code);

  if (!verification.ok) {
    await recordAdminAuditEvent(
      "login_mfa_failed",
      `Two-step code rejected: ${verification.reason}`,
      "warning",
    );
    return { ok: false, message: verification.reason, requiresMfa: true, challengeToken, remember };
  }

  const staff = await getAdminStaffAccountById(verification.staffId);
  if (!staff || staff.status !== "Active" || !staff.mfaEnabled) {
    return { ok: false, message: "This staff account cannot complete sign in." };
  }

  const key = await loginKey();
  await clearLoginRateLimit(key);
  return completeStaffLogin(staff, true, await loginRequestContext(), remember);
}

export async function signInFromEmailLinkAction(formData: FormData): Promise<LoginState> {
  const token = textValue(formData, "t");
  const code = textValue(formData, "c");
  const remember = formData.get("remember") === "on";
  const expired: LoginState = {
    ok: false,
    message: "यो link सकियो वा प्रयोग भइसक्यो। फेरि login गर्नुहोस्।",
  };

  const verification = await verifyAdminStaffMfaCode(token, code);

  if (!verification.ok) {
    await recordAdminAuditEvent(
      "login_mfa_link_failed",
      `Email sign-in link rejected: ${verification.reason}`,
      "warning",
    );
    return expired;
  }

  const staff = await getAdminStaffAccountById(verification.staffId);

  if (!staff || staff.status !== "Active" || !staff.mfaEnabled) {
    return { ok: false, message: "This staff account cannot complete sign in." };
  }

  await clearLoginRateLimit(await loginKey());
  await recordAdminAuditEvent(
    "login_mfa_link_used",
    `Signed in from the emailed link for ${staff.email}.`,
    "success",
    { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
  );

  return completeStaffLogin(staff, true, await loginRequestContext(), remember);
}

/** Whether a link is still worth showing a button for. Peeks, never consumes. */
export async function emailLinkStillValid(token: string) {
  return Boolean(await getValidAdminStaffToken(token.trim(), "mfa_login"));
}

export async function logoutAdminAction() {
  const session = await getAdminSession();

  if (session) {
    await recordAdminAuditEvent("logout", "Admin session cleared.");
    if (session.sessionId) {
      await revokeAdminStaffSession(session.sessionId, session.staffId ?? "self");
    }
  }

  await clearAdminSessionCookie();
  redirect("/admin/login");
}
