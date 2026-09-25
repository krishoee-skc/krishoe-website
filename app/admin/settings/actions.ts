"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { MAX_DELIVERY_ZONES, deliveryPolicySentence } from "@/lib/delivery-fee";
import { deliveryPricingTag, saveDeliveryPricing } from "@/lib/delivery-settings";
import { prepareDeliveryDatabase } from "@/lib/delivery-database";
import { preparePosDatabase } from "@/lib/pos-database";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { saveBusinessGoal, currentGoalMonthKey } from "@/lib/business-goals";
import { clearAdminSessionCookie } from "@/lib/admin-auth";
import { adminRoles, requireAdminPermission } from "@/lib/admin-permissions";
import {
  addCompanyBranch,
  adminStaffStatuses,
  companyBranchStatuses,
  companyBranchTypes,
  getAdminSettings,
  resetAdminStaffFailedLogins,
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
import { ownerAlertTitles, sendOwnerSecurityAlert } from "@/lib/owner-security-alert";
import { temporaryPasswordProblem } from "@/lib/temporary-password";
import { clearAccountLoginRateLimit, grantAccountLoginUnlock } from "@/lib/login-rate-limit";
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
      billFooterNote: textValue(formData, "billFooterNote"),
      promoText: textValue(formData, "promoText"),
      promoEnabled: textValue(formData, "promoEnabled") === "on",
      googleReviewUrl: textValue(formData, "googleReviewUrl"),
      facebookReviewUrl: textValue(formData, "facebookReviewUrl"),
      bankName: textValue(formData, "bankName"),
      bankAccountName: textValue(formData, "bankAccountName"),
      bankAccountNumber: textValue(formData, "bankAccountNumber"),
      bankBranch: textValue(formData, "bankBranch"),
    });
    await recordAdminAuditEvent("settings_company_update", `Company settings updated for ${companyName}.`);
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Company settings saved.");
}

/** Rupees as typed ("150", "2000") to paisa; blank is 0. */
function rupeesToPaisa(value: string, label: string) {
  if (!value) return 0;
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error(`${label} must be an amount in rupees, 0 or more.`);
  }
  return Math.round(rupees * 100);
}

/**
 * The area rows of the delivery form: a name and a charge each. A blank row is
 * skipped; a charge with no name is a mistake worth saying out loud, because
 * that charge would otherwise vanish on save.
 */
function deliveryZonesFrom(formData: FormData) {
  const zones: { id: string; name: string; feePaisa: number }[] = [];
  for (let row = 1; row <= MAX_DELIVERY_ZONES; row += 1) {
    const name = textValue(formData, `zoneName${row}`);
    const fee = textValue(formData, `zoneFee${row}`);
    if (!name && fee) throw new Error(`Area ${row} has a charge but no name. Name the area, or clear its charge.`);
    if (!name) continue;
    zones.push({ id: "", name, feePaisa: rupeesToPaisa(fee, `The charge for "${name}"`) });
  }
  return zones;
}

/**
 * The Owner's "OK" on adding the delivery columns to the live database
 * (lib/delivery-database.ts). The form carries confirm=yes only from the
 * button inside the preview, so nothing is added without the preview open.
 */
export async function prepareDeliveryDatabaseAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    if (textValue(formData, "confirm") !== "yes") {
      throw new Error("Open the preview and press OK to add the delivery columns.");
    }
    const { applied } = await prepareDeliveryDatabase();
    await recordAdminAuditEvent(
      "settings_database_delivery_ready",
      applied.length
        ? `Database prepared for delivery charges: ${applied.join(", ")}.`
        : "Database was already ready for delivery charges.",
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Database ready for delivery charges. Set the charge by area below.");
}

export async function preparePosDatabaseAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    if (textValue(formData, "confirm") !== "yes") {
      throw new Error("Open the preview and press OK to add the bill column.");
    }
    const { applied } = await preparePosDatabase();
    await recordAdminAuditEvent(
      "settings_database_pos_ready",
      applied.length
        ? `Database prepared for bills paid in parts: ${applied.join(", ")}.`
        : "Database was already ready for bills paid in parts.",
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Database ready for the new counter bill.");
}

export async function saveDeliveryPricingAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    const pricing = await saveDeliveryPricing({
      feePaisa: rupeesToPaisa(textValue(formData, "deliveryFee"), "Delivery charge"),
      freeOverPaisa: rupeesToPaisa(textValue(formData, "freeDeliveryOver"), "Free delivery amount"),
      zones: deliveryZonesFrom(formData),
    });
    await recordAdminAuditEvent("settings_delivery_update", `Delivery set: ${deliveryPolicySentence(pricing)}`);
  } catch (error) {
    failSettingsPage(error);
  }
  // The header, home page and assistant read a cached copy; checkout reads it
  // fresh. Both must show the new charge from the next page view.
  updateTag(deliveryPricingTag);
  revalidatePath("/", "layout");
  refreshSettingsPage("Delivery charge saved.");
}

export async function saveBusinessGoalAction(formData: FormData) {
  try {
    await requireAdminPermission("settings:write");
    const monthKey = textValue(formData, "monthKey") || currentGoalMonthKey();
    await saveBusinessGoal({
      monthKey,
      salesGoal: Number(textValue(formData, "salesGoal")) || 0,
      profitGoal: Number(textValue(formData, "profitGoal")) || 0,
      productionGoal: Number(textValue(formData, "productionGoal")) || 0,
      note: textValue(formData, "goalNote"),
    });
    await recordAdminAuditEvent("settings_goal_update", `Business goal set for ${monthKey}.`);
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("This month's goal saved.");
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

    if (!name) throw new Error("नाम चाहिन्छ।");
    if (phoneInput && !phone) throw new Error("मोबाइल नम्बर मिलेन — ठीक नम्बर हाल्नुहोस्, वा खाली छाड्नुहोस्।");
    if (!email && !phone) {
      throw new Error("Email वा मोबाइल नम्बर — कम्तीमा एउटा चाहिन्छ।");
    }

    const phoneOnly = !email;
    // The same rules as a password someone picks for themselves, and not their
    // own name. Eight characters used to be enough, so they came out as the
    // worker's name and a count. The form offers a strong one (🎲).
    const weakTemporary = phoneOnly ? temporaryPasswordProblem(temporaryPassword, name) : "";
    if (weakTemporary) {
      throw new Error(`Temporary password: ${weakTemporary} Use the 🎲 button for a strong one.`);
    }

    const existingSettings = await getAdminSettings();
    if (email && existingSettings.staff.some((member) => member.email.toLowerCase() === email)) {
      throw new Error("यो email भएको खाता पहिले नै छ।");
    }
    if (phone && existingSettings.staff.some((member) => normalizeStaffPhone(member.phone) === phone)) {
      throw new Error("यो मोबाइल नम्बर भएको खाता पहिले नै छ।");
    }

    if (phoneOnly) {
      const role = optionValue(textValue(formData, "role"), adminRoles, "Viewer");
      // Every role but Worker signs in with a code sent to email. Made with a
      // mobile number alone, such an account could never finish signing in —
      // so say so now, rather than hand out a password that cannot open it.
      if (role !== "Worker") {
        throw new Error(
          `A ${role} account needs an email for the sign-in security code. Add an email, or choose Worker for a mobile-only account.`,
        );
      }
      const worker = await saveAdminStaffAccount({
        name,
        phone,
        role,
        branchId: textValue(formData, "branchId"),
        employeeId: textValue(formData, "employeeId"),
        factoryWorkerId: textValue(formData, "factoryWorkerId"),
        status: "Active",
        password: temporaryPassword,
        temporaryPassword: true,
        // On like every other account. A mobile-only Worker has no email for
        // the code, so sign-in skips it for them (app/admin/login/actions.ts);
        // it takes effect the day an email is added to the account.
        mfaEnabled: true,
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
        { title: ownerAlertTitles.staffCreated.ne, body: `${worker.name} · ${worker.role} · ${formatStaffPhone(worker.phone)}`, tag: `staff-created-${worker.id}` },
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
        { title: ownerAlertTitles.staffCreated.ne, body: `${staff.name} · ${staff.role} · ${staff.email}`, tag: `staff-created-${staff.id}` },
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
      staff.role !== updated.role
        ? { title: ownerAlertTitles.accessChanged.ne, body: `${updated.name}: ${staff.role} → ${updated.role}`, tag: `staff-role-${updated.id}` }
        : undefined,
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
    const weakTemporary = temporaryPasswordProblem(temporaryPassword, staff.name);
    if (weakTemporary) {
      throw new Error(`Temporary password: ${weakTemporary} Use the 🎲 button for a strong one.`);
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
      { title: ownerAlertTitles.temporaryPassword.ne, body: `${staff.name} · ${staffSignInLabel(staff)}`, tag: `staff-temp-${staff.id}` },
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
    // Two-step sign-in is required for everyone now, so it can be switched on but
    // not off for an account that is in use. Turning it off is refused gently —
    // no error, no lock-out — rather than removed, so an older screen or a habit
    // still lands somewhere that explains why. A disabled account may be left as
    // it is; only active accounts must keep the second factor.
    if (!enabled && staff.status === "Active") {
      refreshSettingsPage(
        "Two-step verification is required for all active staff and cannot be turned off. It stays on.",
      );
      return;
    }
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
      { title: ownerAlertTitles.statusChanged.ne, body: `${updated.name}: ${staff.status} → ${updated.status}`, tag: `staff-status-${updated.id}` },
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Staff status saved. Disabled or locked accounts were signed out automatically.");
}

/**
 * The Owner lifting a wrong-password block on one account.
 *
 * The account's own count is cleared and, for fifteen minutes, the per-address
 * limit stops applying to sign-ins to it — the block a worker who mistyped
 * actually meets (lib/login-rate-limit.ts). Recorded in the security trail
 * with the Owner named.
 */
export async function unlockStaffLoginAction(formData: FormData) {
  try {
    const actor = await requireAdminPermission("settings:write");
    const staff = await getExistingStaff(formData);
    for (const identifier of [staff.email, staff.phone].filter(Boolean)) {
      await clearAccountLoginRateLimit(identifier);
      await grantAccountLoginUnlock(identifier);
    }
    await resetAdminStaffFailedLogins(staff.id);
    await recordAdminAuditEvent(
      "settings_staff_unlocked",
      `${actor.session.email ?? "Owner"} unlocked sign-in for ${staff.name} (${staffSignInLabel(staff)}). Wrong-password blocks are lifted for 15 minutes.`,
      "success",
    );
  } catch (error) {
    failSettingsPage(error);
  }
  refreshSettingsPage("Unlocked. They can sign in now.");
}
