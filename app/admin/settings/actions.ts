"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { clearAdminSessionCookie } from "@/lib/admin-auth";
import { adminRoles, requireAdminPermission } from "@/lib/admin-permissions";
import {
  addCompanyBranch,
  adminStaffStatuses,
  companyBranchStatuses,
  companyBranchTypes,
  getAdminSettings,
  saveAdminStaffAccount,
  saveCompanySettings,
  setAdminStaffMfa,
  updateAdminStaffPassword,
  type SafeAdminStaffAccount,
} from "@/lib/admin-settings";
import {
  createAdminStaffToken,
  recordAdminStaffAccessHistory,
  revokeAllAdminStaffSessions,
} from "@/lib/admin-staff-security";
import { emailLinkBaseUrl } from "@/lib/email-links";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { formatStaffPhone, normalizeStaffPhone, staffSignInLabel } from "@/lib/staff-phone";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

const publicSiteUrl = emailLinkBaseUrl;

function friendlyError(error: unknown) {
  return error instanceof Error && error.message
    ? error.message.slice(0, 240)
    : "The requested settings change could not be saved.";
}

function settingsLocation(kind: "success" | "error", message: string) {
  return `/admin/settings?${kind}=${encodeURIComponent(message)}`;
}

function refreshSettingsPage(message: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/devices");
  redirect(settingsLocation("success", message));
}

function failSettingsPage(error: unknown): never {
  redirect(settingsLocation("error", friendlyError(error)));
}

async function requestContext() {
  const requestHeaders = await headers();
  return {
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      || requestHeaders.get("x-real-ip")?.trim()
      || "",
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? "",
  };
}

function staffAuditState(staff: SafeAdminStaffAccount) {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    branchId: staff.branchId,
    status: staff.status,
    employeeId: staff.employeeId ?? null,
    mfaEnabled: staff.mfaEnabled,
    mustChangePassword: staff.mustChangePassword,
  };
}

async function getExistingStaff(formData: FormData): Promise<SafeAdminStaffAccount> {
  const id = textValue(formData, "id");
  if (!id) throw new Error("Staff id is required.");
  const settings = await getAdminSettings();
  const staff = settings.staff.find((member) => member.id === id);
  if (!staff) throw new Error("Staff account not found.");
  return staff;
}

async function recordStaffChange(
  action: string,
  before: SafeAdminStaffAccount | null,
  after: SafeAdminStaffAccount,
  actor: Awaited<ReturnType<typeof requireAdminPermission>>,
) {
  await recordAdminStaffAccessHistory({
    staffId: after.id,
    action,
    beforeState: before ? staffAuditState(before) : {},
    afterState: staffAuditState(after),
    actorId: actor.session.staffId,
    actorEmail: actor.session.email,
    actorRole: actor.role,
    ...(await requestContext()),
  });
}

async function revokeSecuritySessions(
  targetStaffId: string,
  actor: Awaited<ReturnType<typeof requireAdminPermission>>,
  reason: string,
) {
  const count = await revokeAllAdminStaffSessions(
    targetStaffId,
    actor.session.staffId ?? actor.session.email ?? reason,
  );
  if (targetStaffId === actor.session.staffId) {
    await clearAdminSessionCookie();
  }
  return count;
}

async function sendOwnerSecurityAlert(subject: string, message: string) {
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
  return results.some(
    (result) => result.status === "fulfilled" && result.value.ok,
  );
}

export async function saveCompanySettingsAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    const companyName = textValue(formData, "companyName");
    if (!companyName) throw new Error("Company name is required.");

    await saveCompanySettings({
      companyName,
      legalName: textValue(formData, "legalName"),
      phone: textValue(formData, "phone"),
      email: textValue(formData, "email"),
      address: textValue(formData, "address"),
      panVatNumber: textValue(formData, "panVatNumber"),
      currency: textValue(formData, "currency"),
      timezone: textValue(formData, "timezone"),
      defaultBranchId: textValue(formData, "defaultBranchId"),
    });
    await recordAdminAuditEvent("settings_company_update", `Company settings updated for ${companyName}.`);
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Company settings saved.");
}

export async function createBranchAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    const name = textValue(formData, "name");
    if (!name) throw new Error("Branch name is required.");

    const branch = await addCompanyBranch({
      name,
      code: textValue(formData, "code"),
      type: optionValue(textValue(formData, "type"), companyBranchTypes, "Retail"),
      phone: textValue(formData, "phone"),
      address: textValue(formData, "address"),
      status: optionValue(textValue(formData, "status"), companyBranchStatuses, "Active"),
    });
    await recordAdminAuditEvent("settings_branch_create", `Branch ${branch.name} created.`);
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Branch created successfully.");
}

/**
 * Creates a staff or worker sign-in.
 *
 * Two routes, chosen by what the person actually has. With an email they get
 * the zero-knowledge invitation: a one-time link, and the Owner never learns
 * their password. A worker with only a phone cannot receive anything, so the
 * Owner sets a temporary password and hands it over in person; it is marked
 * must-change, so it stops working the moment the worker signs in and picks
 * their own.
 */
export async function inviteStaffAccountAction(formData: FormData) {
  let deliveryFailed = false;
  // redirect() throws, so the success redirect has to happen outside the try —
  // inside it, failSettingsPage would swallow the redirect and report the
  // successful save as an error.
  let successMessage = "";
  try {
    const actor = await requireAdminPermission("settings:write");
    const name = textValue(formData, "name");
    const email = textValue(formData, "email").toLowerCase();
    const phoneInput = textValue(formData, "phone");
    const phone = normalizeStaffPhone(phoneInput);
    const temporaryPassword = textValue(formData, "temporaryPassword");

    if (!name) throw new Error("Staff name is required.");
    if (phoneInput && !phone) throw new Error("Enter a valid mobile number, or leave it empty.");
    if (!email && !phone) {
      throw new Error("Enter an email address, a mobile number, or both.");
    }

    const phoneOnly = !email;
    if (phoneOnly && temporaryPassword.length < 8) {
      throw new Error(
        "A mobile-only account needs a temporary password of at least 8 characters to hand over.",
      );
    }

    const existingSettings = await getAdminSettings();
    if (email && existingSettings.staff.some((member) => member.email.toLowerCase() === email)) {
      throw new Error("A staff account with this email already exists.");
    }
    if (phone && existingSettings.staff.some((member) => normalizeStaffPhone(member.phone) === phone)) {
      throw new Error("A staff account with this mobile number already exists.");
    }

    if (phoneOnly) {
      const worker = await saveAdminStaffAccount({
        name,
        phone,
        role: optionValue(textValue(formData, "role"), adminRoles, "Viewer"),
        branchId: textValue(formData, "branchId"),
        employeeId: textValue(formData, "employeeId"),
        factoryWorkerId: textValue(formData, "factoryWorkerId"),
        status: "Active",
        password: temporaryPassword,
        temporaryPassword: true,
        mfaEnabled: false,
      });
      await recordStaffChange("staff_created_with_temporary_password", null, worker, actor);
      await recordAdminAuditEvent(
        "settings_staff_created_mobile",
        `Mobile sign-in created for ${worker.name} (${worker.phone}) as ${worker.role}. A temporary password was set and must be changed at first sign-in.`,
        "success",
      );
      await sendOwnerSecurityAlert(
        "KRISHOE mobile staff account created",
        `${actor.session.email ?? "Owner"} created a mobile sign-in for ${worker.name} (${worker.phone}) as ${worker.role}. The temporary password is not included in this alert.`,
      );
      successMessage =
        `${worker.name} can now sign in with ${formatStaffPhone(worker.phone)} and the temporary password you set. They must change it at first sign-in.`;
    }

    if (!successMessage) {

      const staff = await saveAdminStaffAccount({
        name,
        email,
        phone,
        role: optionValue(textValue(formData, "role"), adminRoles, "Viewer"),
        branchId: textValue(formData, "branchId"),
        employeeId: textValue(formData, "employeeId"),
        factoryWorkerId: textValue(formData, "factoryWorkerId"),
        status: "Invited",
        mustChangePassword: false,
        mfaEnabled: formData.get("mfaEnabled") === "on",
      });
      const invitation = await createAdminStaffToken(staff.id, "invitation", {
        expiresInMinutes: 48 * 60,
        createdBy: actor.session.staffId ?? actor.session.email ?? "Owner",
      });
      const invitationUrl = `${publicSiteUrl()}/admin/accept-invite?token=${encodeURIComponent(invitation.token)}`;
      const delivery = await sendStaffSecurityEmail({
        email: staff.email,
        subject: "Your KRISHOE staff invitation",
        payload: {
          email: staff.email,
          kind: "invitation",
          message: `You were invited to KRISHOE Admin as ${staff.role}. Use this one-time link to create your password.`,
          actionUrl: invitationUrl,
          expiresAt: invitation.expiresAt,
        },
      });
      deliveryFailed = !delivery.ok;
      await recordStaffChange("staff_invited", null, staff, actor);
      await recordAdminAuditEvent(
        delivery.ok ? "settings_staff_invite" : "settings_staff_invite_delivery_failed",
        delivery.ok
          ? `Invitation sent to ${staff.email} with ${staff.role} role.`
          : `Invitation created for ${staff.email}, but email delivery failed: ${delivery.error}`,
        delivery.ok ? "success" : "warning",
      );
      await sendOwnerSecurityAlert(
        "KRISHOE staff invitation created",
        `${actor.session.email ?? "Owner"} invited ${staff.email} as ${staff.role} for branch ${staff.branchId}.`,
      );
      successMessage = deliveryFailed
        ? "Staff invitation created, but email was not delivered. Check email settings and use Resend invitation."
        : "Secure staff invitation sent.";
    }
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage(successMessage);
}

// Backward-compatible name for any bookmarked/older form submission. New UI
// always creates staff through a one-time invitation and never exposes a
// password to the Owner.
export const saveStaffAccountAction = inviteStaffAccountAction;

export async function resendStaffInvitationAction(formData: FormData) {
  let delivered = false;
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    if (staff.status !== "Invited") throw new Error("Only an invited account can receive a new invitation.");

    const invitation = await createAdminStaffToken(staff.id, "invitation", {
      expiresInMinutes: 48 * 60,
      createdBy: actor.session.staffId ?? actor.session.email ?? "Owner",
    });
    const invitationUrl = `${publicSiteUrl()}/admin/accept-invite?token=${encodeURIComponent(invitation.token)}`;
    const result = await sendStaffSecurityEmail({
      email: staff.email,
      subject: "Your new KRISHOE staff invitation",
      payload: {
        email: staff.email,
        kind: "invitation",
        message: `A new invitation was issued for your ${staff.role} staff account. The previous link no longer works.`,
        actionUrl: invitationUrl,
        expiresAt: invitation.expiresAt,
      },
    });
    delivered = result.ok;
    await recordStaffChange("staff_invitation_resent", staff, staff, actor);
    await recordAdminAuditEvent(
      result.ok ? "settings_staff_invite_resent" : "settings_staff_invite_delivery_failed",
      result.ok ? `Invitation resent to ${staff.email}.` : `Invitation email failed for ${staff.email}: ${result.error}`,
      result.ok ? "success" : "warning",
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage(delivered ? "New invitation sent." : "Invitation renewed, but email delivery failed.");
}

export async function updateStaffAccessAction(formData: FormData) {
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    const nextRole = optionValue(textValue(formData, "role"), adminRoles, staff.role);
    const settings = await getAdminSettings();
    const activeOwners = settings.staff.filter(
      (member) => member.status === "Active" && member.role === "Owner",
    );
    if (staff.status === "Active" && staff.role === "Owner" && nextRole !== "Owner" && activeOwners.length <= 1) {
      throw new Error("Create another active Owner before changing the last Owner role.");
    }

    const updated = await saveAdminStaffAccount({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: nextRole,
      branchId: textValue(formData, "branchId") || staff.branchId,
      employeeId: textValue(formData, "employeeId"),
      factoryWorkerId: textValue(formData, "factoryWorkerId"),
      status: staff.status,
      mustChangePassword: staff.mustChangePassword,
      mfaEnabled: staff.mfaEnabled,
      invitationAcceptedAt: staff.invitationAcceptedAt,
    });
    const accessSecurityChanged = staff.role !== updated.role || staff.branchId !== updated.branchId;
    const revokedSessions = accessSecurityChanged
      ? await revokeSecuritySessions(updated.id, actor, "access-change")
      : 0;
    await recordStaffChange("staff_access_updated", staff, updated, actor);
    await recordAdminAuditEvent(
      "settings_staff_access_update",
      `Staff ${updated.email} access updated to ${updated.role}. ${revokedSessions} session(s) revoked.`,
    );
    await sendOwnerSecurityAlert(
      "KRISHOE staff access changed",
      `${actor.session.email ?? "Owner"} changed ${updated.email}: role ${staff.role} → ${updated.role}, branch ${staff.branchId} → ${updated.branchId}. ${revokedSessions} old session(s) were signed out.`,
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Staff role, branch, and HR link saved.");
}

export async function sendStaffPasswordResetAction(formData: FormData) {
  let delivered = false;
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    if (staff.status !== "Active") throw new Error("Enable this account before sending a password reset.");

    const reset = await createAdminStaffToken(staff.id, "password_reset", {
      expiresInMinutes: 60,
      createdBy: actor.session.staffId ?? actor.session.email ?? "Owner",
    });
    const resetUrl = `${publicSiteUrl()}/admin/reset-password?token=${encodeURIComponent(reset.token)}`;
    const result = await sendStaffSecurityEmail({
      email: staff.email,
      subject: "Reset your KRISHOE staff password",
      payload: {
        email: staff.email,
        kind: "password-reset",
        message: "The Owner issued a one-time password reset link for your KRISHOE staff account.",
        actionUrl: resetUrl,
        expiresAt: reset.expiresAt,
      },
    });
    delivered = result.ok;
    await recordStaffChange("staff_password_reset_sent", staff, staff, actor);
    await recordAdminAuditEvent(
      result.ok ? "settings_staff_password_reset_sent" : "settings_staff_password_reset_delivery_failed",
      result.ok ? `Password reset link sent to ${staff.email}.` : `Password reset email failed for ${staff.email}: ${result.error}`,
      result.ok ? "success" : "warning",
    );
    await sendOwnerSecurityAlert(
      "KRISHOE staff password reset requested",
      `${actor.session.email ?? "Owner"} sent a password reset link to ${staff.email}. Existing sessions will be signed out automatically when the password is changed.`,
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage(delivered ? "Password reset link sent." : "Reset link created, but email delivery failed.");
}

export const resetStaffPasswordAction = sendStaffPasswordResetAction;

/**
 * Recovery for a worker with no inbox.
 *
 * Nothing can be emailed to them, so the Owner sets a password and says it out
 * loud. Everything that makes that safe happens here: the account is forced to
 * change it at the next sign-in, every existing session is cut, and the change
 * is written to the security trail with the Owner named as the actor.
 */
export async function setStaffTemporaryPasswordAction(formData: FormData) {
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    const temporaryPassword = textValue(formData, "temporaryPassword");

    if (staff.status === "Disabled") {
      throw new Error("Enable this account before giving it a new password.");
    }
    if (temporaryPassword.length < 8) {
      throw new Error("A temporary password must be at least 8 characters.");
    }

    await updateAdminStaffPassword(staff.id, temporaryPassword, {
      mustChangePassword: true,
      activateInvitation: staff.status === "Invited",
    });
    const revokedSessions = await revokeSecuritySessions(staff.id, actor, "temporary-password");
    await recordStaffChange("staff_temporary_password_set", staff, staff, actor);
    await recordAdminAuditEvent(
      "settings_staff_temporary_password",
      `${actor.session.email ?? "Owner"} set a temporary password for ${staff.name}. ${revokedSessions} session(s) revoked; it must be changed at next sign-in.`,
      "warning",
    );
    await sendOwnerSecurityAlert(
      "KRISHOE temporary password issued",
      `${actor.session.email ?? "Owner"} issued a temporary password for ${staff.name} (${staffSignInLabel(staff)}). The password itself is not included in this alert.`,
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Temporary password set. Tell them in person — they must change it at first sign-in.");
}

export async function updateStaffMfaAction(formData: FormData) {
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    const enabled = textValue(formData, "enabled") === "true";
    const updated = await setAdminStaffMfa(staff.id, enabled);
    const revokedSessions = await revokeSecuritySessions(updated.id, actor, "mfa-change");
    await recordStaffChange(enabled ? "staff_mfa_enabled" : "staff_mfa_disabled", staff, updated, actor);
    await recordAdminAuditEvent(
      enabled ? "settings_staff_mfa_enabled" : "settings_staff_mfa_disabled",
      `Email 2-step verification ${enabled ? "enabled" : "disabled"} for ${updated.email}. ${revokedSessions} session(s) revoked.`,
    );
    await sendOwnerSecurityAlert(
      "KRISHOE staff 2-step verification changed",
      `${actor.session.email ?? "Owner"} ${enabled ? "enabled" : "disabled"} email 2-step verification for ${updated.email}. ${revokedSessions} old session(s) were signed out.`,
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("2-step verification setting saved.");
}

export async function updateStaffStatusAction(formData: FormData) {
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    const nextStatus = optionValue(textValue(formData, "status"), adminStaffStatuses, staff.status);
    if (staff.role === "Owner" && staff.status === "Active" && nextStatus !== "Active") {
      const settings = await getAdminSettings();
      const activeOwners = settings.staff.filter(
        (member) => member.status === "Active" && member.role === "Owner",
      );
      if (activeOwners.length <= 1) throw new Error("The last active Owner cannot be disabled.");
    }

    const updated = await saveAdminStaffAccount({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branchId: staff.branchId,
      employeeId: staff.employeeId,
      status: nextStatus,
      mustChangePassword: staff.mustChangePassword,
      mfaEnabled: staff.mfaEnabled,
      invitationAcceptedAt: staff.invitationAcceptedAt,
    });
    const revokedSessions = nextStatus === "Disabled" || nextStatus === "Locked"
      ? await revokeSecuritySessions(updated.id, actor, "account-status-change")
      : 0;
    await recordStaffChange("staff_status_updated", staff, updated, actor);
    await recordAdminAuditEvent(
      "settings_staff_status_update",
      `Staff ${updated.email} marked ${updated.status}. ${revokedSessions} session(s) revoked.`,
    );
    await sendOwnerSecurityAlert(
      "KRISHOE staff status changed",
      `${actor.session.email ?? "Owner"} changed ${updated.email} from ${staff.status} to ${updated.status}. ${revokedSessions} old session(s) were signed out.`,
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Staff status saved. Disabled or locked accounts were signed out automatically.");
}
