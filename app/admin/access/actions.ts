"use server";

import { headers } from "next/headers";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import {
  getAdminSession,
  requireAdminSession,
  setAdminSessionCookie,
} from "@/lib/admin-auth";
import { adminPasswordPolicyMessage } from "@/lib/admin-password-policy";
import {
  getAdminSettings,
  getAdminStaffAccountByEmail,
  getAdminStaffAccountById,
  updateAdminStaffPassword,
  verifyAdminStaffCredentials,
} from "@/lib/admin-settings";
import {
  createAdminSessionToken,
  getAdminSessionMaxAge,
} from "@/lib/admin-session";
import {
  consumeAdminStaffToken,
  createAdminStaffSession,
  createAdminStaffToken,
  getValidAdminStaffToken,
  recordAdminStaffAccessHistory,
  revokeAllAdminStaffSessions,
  verifyAdminStaffResetCode,
} from "@/lib/admin-staff-security";
import { emailLinkBaseUrl } from "@/lib/email-links";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

export type AdminAccessActionState = {
  ok: boolean;
  message: string;
  href?: string;
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const publicSiteUrl = emailLinkBaseUrl;

async function requestFingerprint(email = "") {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const userAgent = headerStore.get("user-agent")?.slice(0, 120) ?? "unknown";
  return `${forwardedFor || realIp || `local:${userAgent}`}|${email.toLowerCase()}`;
}

async function securityRequestContext() {
  const headerStore = await headers();
  return {
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headerStore.get("x-real-ip")?.trim()
      || "",
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? "",
  };
}

async function shortDelay() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function sendOwnerAccessAlert(subject: string, message: string) {
  const settings = await getAdminSettings();
  const recipients = [...new Set([
    settings.company.email.trim().toLowerCase(),
    ...settings.staff
      .filter((member) => member.role === "Owner" && member.status === "Active")
      .map((member) => member.email.trim().toLowerCase()),
  ].filter(Boolean))];

  await Promise.allSettled(
    recipients.map((email) => sendStaffSecurityEmail({
      email,
      subject,
      payload: { email, kind: "security-alert", message },
    })),
  );
}

export async function requestAdminPasswordResetAction(
  _previousState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const email = textValue(formData, "email").toLowerCase();
  const genericMessage = "If an active staff account exists, reset instructions will be sent shortly.";

  if (!email) return { ok: false, message: "Staff email is required." };

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "admin-password-reset",
    key: await requestFingerprint(email),
    maxAttempts: 4,
    windowMs: 15 * 60_000,
  });
  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many reset requests. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const staff = await getAdminStaffAccountByEmail(email);
  if (!staff || staff.status !== "Active") {
    await shortDelay();
    return { ok: true, message: genericMessage };
  }

  // Both a link and a code. The link is the quick path; the code is the one
  // that survives an email client that mangles URLs, a phone that opens the
  // link in a browser without the session, or a reset started on the computer
  // and finished on the phone.
  const reset = await createAdminStaffToken(staff.id, "password_reset", {
    expiresInMinutes: 60,
    withCode: true,
    codeBoundTo: "staff",
  });
  const resetUrl = `${publicSiteUrl()}/admin/reset-password?token=${encodeURIComponent(reset.token)}`;
  const delivery = await sendStaffSecurityEmail({
    email: staff.email,
    subject: "Reset your KRISHOE staff password",
    payload: {
      email: staff.email,
      kind: "password-reset",
      message: [
        "A KRISHOE staff password reset was requested. Ignore this email if it was not you.",
        "",
        `Your 6-digit reset code is ${reset.code}`,
        `Enter it at ${publicSiteUrl()}/admin/reset-password`,
        "",
        "Or open the one-time link below.",
      ].join("\n"),
      actionUrl: resetUrl,
      expiresAt: reset.expiresAt,
    },
  });

  await recordAdminAuditEvent(
    delivery.ok ? "staff_password_reset_requested" : "staff_password_reset_delivery_failed",
    delivery.ok
      ? `Password reset instructions sent to ${staff.email}.`
      : `Password reset email failed for ${staff.email}: ${delivery.error}`,
    delivery.ok ? "success" : "warning",
    { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
  );
  await sendOwnerAccessAlert(
    "KRISHOE staff password reset requested",
    `A password reset was requested for ${staff.email}. No password or reset secret is included in this alert.`,
  );

  return { ok: true, message: genericMessage };
}

async function validateNewPassword(formData: FormData) {
  const password = textValue(formData, "password");
  const confirmPassword = textValue(formData, "confirmPassword");
  const policyMessage = adminPasswordPolicyMessage(password);
  if (policyMessage) return { error: policyMessage, password: "" };
  if (password !== confirmPassword) {
    return { error: "New password and confirmation do not match.", password: "" };
  }
  return { error: "", password };
}

export async function completeAdminPasswordResetAction(
  _previousState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const token = textValue(formData, "token");
  const passwordResult = await validateNewPassword(formData);
  if (!token) return { ok: false, message: "Invalid password reset link." };
  if (passwordResult.error) return { ok: false, message: passwordResult.error };

  const valid = await getValidAdminStaffToken(token, "password_reset");
  if (!valid) return { ok: false, message: "This password reset link is invalid or expired." };

  const consumed = await consumeAdminStaffToken(token, "password_reset");
  if (!consumed) return { ok: false, message: "This password reset link was already used." };

  const updated = await updateAdminStaffPassword(consumed.staffId, passwordResult.password, {
    mustChangePassword: false,
  });
  const revokedSessions = await revokeAllAdminStaffSessions(updated.id, "password-reset");
  await recordAdminStaffAccessHistory({
    staffId: updated.id,
    action: "password_reset_completed",
    beforeState: { activeSessions: revokedSessions },
    afterState: { activeSessions: 0, passwordChanged: true },
    actorId: updated.id,
    actorEmail: updated.email,
    actorRole: updated.role,
    ...(await securityRequestContext()),
  });
  await recordAdminAuditEvent(
    "staff_password_reset_completed",
    `Staff ${updated.email} completed password reset. ${revokedSessions} existing session(s) were revoked.`,
    "success",
    { actorId: updated.id, actorEmail: updated.email, actorRole: updated.role },
  );
  await sendOwnerAccessAlert(
    "KRISHOE staff password changed",
    `${updated.email} completed a password reset. ${revokedSessions} old session(s) were signed out automatically.`,
  );

  return { ok: true, message: "Password reset complete. You can now sign in.", href: "/admin/login" };
}

/**
 * The code path to the same destination as completeAdminPasswordResetAction.
 *
 * Email, six digits, and the new password arrive together, so nothing depends
 * on the emailed link having survived intact.
 */
export async function completeAdminPasswordResetWithCodeAction(
  _previousState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const email = textValue(formData, "email").toLowerCase();
  const code = textValue(formData, "code");
  const wrongCode = "That email and code do not match, or the code has expired.";

  if (!email) return { ok: false, message: "Staff email is required." };

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "admin-password-reset-code",
    key: await requestFingerprint(email),
    maxAttempts: 8,
    windowMs: 15 * 60_000,
  });
  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const passwordResult = await validateNewPassword(formData);
  if (passwordResult.error) return { ok: false, message: passwordResult.error };

  const staff = await getAdminStaffAccountByEmail(email);
  if (!staff || staff.status !== "Active") {
    await shortDelay();
    return { ok: false, message: wrongCode };
  }

  const verified = await verifyAdminStaffResetCode(staff.id, code);
  if (!verified.ok) {
    await recordAdminAuditEvent(
      "staff_password_reset_code_rejected",
      `Password reset code rejected for ${staff.email}: ${verified.reason}`,
      "warning",
      { actorId: staff.id, actorEmail: staff.email, actorRole: staff.role },
    );
    await shortDelay();
    return { ok: false, message: verified.reason };
  }

  const updated = await updateAdminStaffPassword(staff.id, passwordResult.password, {
    mustChangePassword: false,
  });
  const revokedSessions = await revokeAllAdminStaffSessions(updated.id, "password-reset");
  await recordAdminStaffAccessHistory({
    staffId: updated.id,
    action: "password_reset_completed",
    beforeState: { activeSessions: revokedSessions, method: "code" },
    afterState: { activeSessions: 0, passwordChanged: true },
    actorId: updated.id,
    actorEmail: updated.email,
    actorRole: updated.role,
    ...(await securityRequestContext()),
  });
  await recordAdminAuditEvent(
    "staff_password_reset_completed",
    `Staff ${updated.email} completed a password reset with an emailed code. ${revokedSessions} existing session(s) were revoked.`,
    "success",
    { actorId: updated.id, actorEmail: updated.email, actorRole: updated.role },
  );
  await sendOwnerAccessAlert(
    "KRISHOE staff password changed",
    `${updated.email} completed a password reset with an emailed code. ${revokedSessions} old session(s) were signed out automatically.`,
  );

  return { ok: true, message: "Password reset complete. You can now sign in.", href: "/admin/login" };
}

export async function acceptAdminInvitationAction(
  _previousState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const token = textValue(formData, "token");
  const passwordResult = await validateNewPassword(formData);
  if (!token) return { ok: false, message: "Invalid staff invitation." };
  if (passwordResult.error) return { ok: false, message: passwordResult.error };

  const valid = await getValidAdminStaffToken(token, "invitation");
  if (!valid) return { ok: false, message: "This invitation is invalid or expired." };

  const staff = await getAdminStaffAccountById(valid.staffId);
  if (!staff || staff.status !== "Invited") {
    return { ok: false, message: "This invitation is no longer active." };
  }
  const consumed = await consumeAdminStaffToken(token, "invitation");
  if (!consumed) return { ok: false, message: "This invitation was already used." };

  const updated = await updateAdminStaffPassword(consumed.staffId, passwordResult.password, {
    mustChangePassword: false,
    activateInvitation: true,
  });
  await recordAdminStaffAccessHistory({
    staffId: updated.id,
    action: "staff_invitation_accepted",
    beforeState: { status: "Invited" },
    afterState: { status: updated.status, passwordCreated: true },
    actorId: updated.id,
    actorEmail: updated.email,
    actorRole: updated.role,
    ...(await securityRequestContext()),
  });
  await recordAdminAuditEvent(
    "staff_invitation_accepted",
    `Staff ${updated.email} accepted the invitation and activated the account.`,
    "success",
    { actorId: updated.id, actorEmail: updated.email, actorRole: updated.role },
  );
  await sendOwnerAccessAlert(
    "KRISHOE staff invitation accepted",
    `${updated.email} accepted the ${updated.role} invitation for branch ${updated.branchId}.`,
  );

  return { ok: true, message: "Staff account activated. You can now sign in.", href: "/admin/login" };
}

export async function changeRequiredAdminPasswordAction(
  _previousState: AdminAccessActionState,
  formData: FormData,
): Promise<AdminAccessActionState> {
  const session = await requireAdminSession();
  if (!session.staffId || !session.email || !session.sessionId) {
    return { ok: false, message: "Sign in with a staff account to change this password." };
  }
  const currentPassword = textValue(formData, "currentPassword");
  const verified = await verifyAdminStaffCredentials(session.email, currentPassword);
  if (!verified || verified.id !== session.staffId) {
    return { ok: false, message: "Current password is incorrect." };
  }
  const passwordResult = await validateNewPassword(formData);
  if (passwordResult.error) return { ok: false, message: passwordResult.error };
  if (currentPassword === passwordResult.password) {
    return { ok: false, message: "New password must be different from the current password." };
  }

  const updated = await updateAdminStaffPassword(session.staffId, passwordResult.password, {
    mustChangePassword: false,
  });
  const context = await securityRequestContext();
  const revokedSessions = await revokeAllAdminStaffSessions(updated.id, updated.id);
  const replacementSession = await createAdminStaffSession({
    staffId: updated.id,
    expiresInSeconds: getAdminSessionMaxAge(),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    mfaVerified: Boolean(session.mfaVerified),
  });
  await setAdminSessionCookie(
    await createAdminSessionToken({
      staffId: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      branchId: updated.branchId,
      sessionId: replacementSession.id,
      mustChangePassword: false,
      mfaVerified: session.mfaVerified,
    }),
  );
  await recordAdminStaffAccessHistory({
    staffId: updated.id,
    action: "required_password_changed",
    beforeState: { mustChangePassword: true, activeSessions: revokedSessions },
    afterState: { mustChangePassword: false, activeSessions: 1 },
    actorId: updated.id,
    actorEmail: updated.email,
    actorRole: updated.role,
    ...context,
  });
  await recordAdminAuditEvent(
    "staff_required_password_changed",
    `Staff ${updated.email} changed the temporary password.`,
  );
  await sendOwnerAccessAlert(
    "KRISHOE temporary password changed",
    `${updated.email} replaced the temporary password. ${revokedSessions} old session(s) were signed out.`,
  );
  return { ok: true, message: "Password changed successfully.", href: "/admin" };
}

export async function hasValidAdminAccessToken(
  token: string,
  purpose: "invitation" | "password_reset",
) {
  return Boolean(await getValidAdminStaffToken(token, purpose));
}

export async function currentAdminNeedsPasswordChange() {
  const session = await getAdminSession();
  return Boolean(session?.staffId && session.mustChangePassword);
}
