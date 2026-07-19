"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  addCompanyBranch,
  adminStaffStatuses,
  companyBranchStatuses,
  companyBranchTypes,
  getAdminSettings,
  saveAdminStaffAccount,
  saveCompanySettings,
  type SafeAdminStaffAccount,
} from "@/lib/admin-settings";
import { adminRoles } from "@/lib/admin-permissions";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionValue<T extends string>(value: string, options: readonly T[], fallback: T) {
  return options.includes(value as T) ? (value as T) : fallback;
}

function refreshSettingsPage() {
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

async function getExistingStaff(formData: FormData): Promise<SafeAdminStaffAccount> {
  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Staff id is required.");
  }

  const settings = await getAdminSettings();
  const staff = settings.staff.find((member) => member.id === id);

  if (!staff) {
    throw new Error("Staff account not found.");
  }

  return staff;
}

export async function saveCompanySettingsAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const companyName = textValue(formData, "companyName");

  if (!companyName) {
    throw new Error("Company name is required.");
  }

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

  refreshSettingsPage();
}

export async function createBranchAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const name = textValue(formData, "name");

  if (!name) {
    throw new Error("Branch name is required.");
  }

  const branch = await addCompanyBranch({
    name,
    code: textValue(formData, "code"),
    type: optionValue(textValue(formData, "type"), companyBranchTypes, "Retail"),
    phone: textValue(formData, "phone"),
    address: textValue(formData, "address"),
    status: optionValue(textValue(formData, "status"), companyBranchStatuses, "Active"),
  });
  await recordAdminAuditEvent("settings_branch_create", `Branch ${branch.name} created.`);

  refreshSettingsPage();
}

export async function saveStaffAccountAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const name = textValue(formData, "name");
  const email = textValue(formData, "email");

  if (!name || !email) {
    throw new Error("Staff name and email are required.");
  }

  const staff = await saveAdminStaffAccount({
    id: textValue(formData, "id"),
    name,
    email,
    password: textValue(formData, "password"),
    role: optionValue(textValue(formData, "role"), adminRoles, "Viewer"),
    branchId: textValue(formData, "branchId"),
    status: optionValue(textValue(formData, "status"), adminStaffStatuses, "Active"),
  });
  await recordAdminAuditEvent(
    "settings_staff_save",
    `Staff ${staff.email} saved with ${staff.role} role.`,
  );

  refreshSettingsPage();
}

export async function updateStaffAccessAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const staff = await getExistingStaff(formData);
  const nextRole = optionValue(textValue(formData, "role"), adminRoles, staff.role);
  const nextBranchId = textValue(formData, "branchId") || staff.branchId;
  const updatedStaff = await saveAdminStaffAccount({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: nextRole,
    branchId: nextBranchId,
    status: staff.status,
  });

  await recordAdminAuditEvent(
    "settings_staff_access_update",
    `Staff ${updatedStaff.email} access updated to ${updatedStaff.role}.`,
  );

  refreshSettingsPage();
}

export async function resetStaffPasswordAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const staff = await getExistingStaff(formData);
  const password = textValue(formData, "password");

  if (password.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  const updatedStaff = await saveAdminStaffAccount({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    password,
    role: staff.role,
    branchId: staff.branchId,
    status: staff.status,
  });

  await recordAdminAuditEvent(
    "settings_staff_password_reset",
    `Staff ${updatedStaff.email} password reset by admin.`,
  );

  refreshSettingsPage();
}

export async function updateStaffStatusAction(formData: FormData) {
  await requireAdminPermission("settings:write");

  const staff = await getExistingStaff(formData);
  const nextStatus = optionValue(textValue(formData, "status"), adminStaffStatuses, staff.status);
  const updatedStaff = await saveAdminStaffAccount({
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    branchId: staff.branchId,
    status: nextStatus,
  });

  await recordAdminAuditEvent(
    "settings_staff_status_update",
    `Staff ${updatedStaff.email} marked ${updatedStaff.status}.`,
  );

  refreshSettingsPage();
}
