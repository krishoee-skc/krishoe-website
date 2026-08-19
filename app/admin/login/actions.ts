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
  getAdminSessionMaxAge,
} from "@/lib/admin-session";
import {
  createAdminStaffSession,
  createAdminStaffToken,
  revokeAdminStaffSession,
  verifyAdminStaffMfaCode,
} from "@/lib/admin-staff-security";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { constantTimeEqual } from "@/lib/session-security";
import { isAdminBootstrapLoginAllowed } from "@/lib/admin-bootstrap-login";
import { alertOnNewDeviceLogin } from "@/lib/login-alerts";

export type LoginState = {
  ok: boolean;
  message: string;
  requiresMfa?: boolean;
  challengeToken?: string;
  emailHint?: string;
  nextPath?: string;
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
) {
  const markedStaff = await markAdminStaffLogin(staff.id, context);
  if (!markedStaff) return invalidState;

  const sessionRecord = await createAdminStaffSession({
    staffId: markedStaff.id,
    expiresInSeconds: getAdminSessionMaxAge(),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    mfaVerified,
  });
  await setAdminSessionCookie(
    await createAdminSessionToken({
      staffId: markedStaff.id,
      name: markedStaff.name,
      email: markedStaff.email,
      role: markedStaff.role,
      branchId: markedStaff.branchId,
      sessionId: sessionRecord.id,
      mustChangePassword: markedStaff.mustChangePassword,
      mfaVerified,
    }),
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

export async function loginAdminAction(_previousState: LoginState, formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
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
      const challenge = await createAdminStaffToken(staff.id, "mfa_login", {
        expiresInMinutes: 10,
        withCode: true,
      });
      const delivery = await sendStaffSecurityEmail({
        email: staff.email,
        subject: "Your KRISHOE admin security code",
        payload: {
          email: staff.email,
          kind: "mfa",
          message: `Your one-time KRISHOE admin security code is ${challenge.code}. Do not share this code.`,
          expiresAt: challenge.expiresAt,
        },
      });

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
      };
    }

    await clearLoginRateLimit(key);
    return completeStaffLogin(staff, false, requestContext);
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
  const verification = await verifyAdminStaffMfaCode(challengeToken, code);

  if (!verification.ok) {
    return { ok: false, message: verification.reason, requiresMfa: true, challengeToken };
  }

  const staff = await getAdminStaffAccountById(verification.staffId);
  if (!staff || staff.status !== "Active" || !staff.mfaEnabled) {
    return { ok: false, message: "This staff account cannot complete sign in." };
  }

  const key = await loginKey();
  await clearLoginRateLimit(key);
  return completeStaffLogin(staff, true, await loginRequestContext());
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
