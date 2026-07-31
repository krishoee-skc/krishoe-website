"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { createEmailVerificationToken } from "@/lib/email-verification-store";
import {
  notifyEmailVerificationRequested,
  notifyPasswordResetRequested,
} from "@/lib/notifications";
import { createPasswordResetToken } from "@/lib/password-reset-store";
import {
  getUserById,
  invalidateUserSessions,
  markUserPhoneVerified,
} from "@/lib/user-store";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function accountPaths() {
  revalidatePath("/admin/customers");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
  revalidatePath("/admin/orders");
  revalidatePath("/account");
}

export async function sendCustomerEmailVerificationAction(formData: FormData) {
  await requireAdminPermission("notifications:write");

  const userId = textValue(formData, "userId");
  const user = userId ? await getUserById(userId) : null;

  if (!user) {
    await recordAdminAuditEvent(
      "customer_email_verification_missing",
      `Admin tried to send email verification for missing customer ${userId || "-"}.`,
      "warning",
    );
    accountPaths();
    return;
  }

  if (user.emailVerifiedAt) {
    await recordAdminAuditEvent(
      "customer_email_verification_skipped",
      `Customer ${user.id} email is already verified.`,
      "warning",
    );
    accountPaths();
    return;
  }

  const token = await createEmailVerificationToken(user);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const verificationUrl = `${publicSiteUrl()}/account/verify-email?token=${encodeURIComponent(token)}`;

  const event = await notifyEmailVerificationRequested({
    email: user.email,
    verificationUrl,
    expiresAt,
    requestedAt: new Date().toISOString(),
  });

  await recordAdminAuditEvent(
    "customer_email_verification_sent",
    `Verification email notification ${event.id} created for customer ${user.id}.`,
    event.deliveryStatus === "failed" ? "warning" : "success",
  );
  accountPaths();
}

export async function sendCustomerPasswordResetAction(formData: FormData) {
  await requireAdminPermission("notifications:write");

  const userId = textValue(formData, "userId");
  const user = userId ? await getUserById(userId) : null;

  if (!user) {
    await recordAdminAuditEvent(
      "customer_password_reset_missing",
      `Admin tried to send password reset for missing customer ${userId || "-"}.`,
      "warning",
    );
    accountPaths();
    return;
  }

  const token = await createPasswordResetToken(user.email);
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const resetUrl = `${publicSiteUrl()}/account/reset-password?token=${encodeURIComponent(token)}`;
  const event = await notifyPasswordResetRequested({
    email: user.email,
    resetUrl,
    expiresAt,
    requestedAt: new Date().toISOString(),
  });

  await recordAdminAuditEvent(
    "customer_password_reset_sent",
    `Password reset notification ${event.id} created for customer ${user.id}.`,
    event.deliveryStatus === "failed" ? "warning" : "success",
  );
  accountPaths();
}

export async function markCustomerPhoneVerifiedAction(formData: FormData) {
  await requireAdminPermission("orders:write");

  const userId = textValue(formData, "userId");
  const user = userId ? await getUserById(userId) : null;

  if (!user?.phone) {
    await recordAdminAuditEvent(
      "customer_phone_verification_missing",
      `Admin tried to verify phone for customer ${userId || "-"} but no phone was saved.`,
      "warning",
    );
    accountPaths();
    return;
  }

  await markUserPhoneVerified(user.id, user.phone);
  await recordAdminAuditEvent(
    "customer_phone_verified",
    `Customer ${user.id} phone verified manually from Customers page.`,
  );
  accountPaths();
}

export async function invalidateCustomerSessionsAction(formData: FormData) {
  await requireAdminPermission("orders:write");

  const userId = textValue(formData, "userId");
  const user = userId ? await getUserById(userId) : null;

  if (!user) {
    await recordAdminAuditEvent(
      "customer_sessions_invalidate_missing",
      `Admin tried to invalidate sessions for missing customer ${userId || "-"}.`,
      "warning",
    );
    accountPaths();
    return;
  }

  await invalidateUserSessions(user.id);
  await recordAdminAuditEvent(
    "customer_sessions_invalidated",
    `Customer ${user.id} sessions invalidated manually from Customers page.`,
  );
  accountPaths();
}
