"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import {
  clearCustomerSessionCookie,
  requireCustomerSession,
  setCustomerSessionCookie,
} from "@/lib/customer-auth";
import { validateCustomerProfileInput } from "@/lib/customer-profile";
import { notifyPasswordResetRequested } from "@/lib/notifications";
import {
  createCustomerSessionToken,
  hasCustomerSessionSecret,
} from "@/lib/customer-session";
import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  updateUserPassword,
  verifyPassword,
} from "@/lib/user-store";
import {
  createPasswordResetToken,
  deletePasswordResetToken,
  getPasswordResetToken,
} from "@/lib/password-reset-store";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

export type AccountActionState = {
  ok: boolean;
  message: string;
  resetLink?: string;
};

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function showLocalPasswordResetLink() {
  return process.env.PASSWORD_RESET_SHOW_LOCAL_LINK === "true" || process.env.NODE_ENV !== "production";
}

async function shortDelay() {
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}

async function loginKey(email: string) {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const userAgent = headerStore.get("user-agent")?.slice(0, 80) ?? "unknown";

  return `customer:${email.toLowerCase()}:${forwardedFor || realIp || userAgent}`;
}

export async function loginCustomerAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const email = textValue(formData, "email").toLowerCase();
  const password = textValue(formData, "password");
  const key = await loginKey(email);
  const rateLimit = await checkLoginRateLimit(key);

  if (!hasCustomerSessionSecret()) {
    return { ok: false, message: "Customer session secret is not configured." };
  }

  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }

  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const user = await getUserByEmail(email);
  const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !validPassword) {
    await recordFailedLogin(key);
    await shortDelay();
    return { ok: false, message: "Invalid email or password." };
  }

  await clearLoginRateLimit(key);
  await setCustomerSessionCookie(await createCustomerSessionToken(user));

  return { ok: true, message: "Login successful. Redirecting..." };
}

export async function registerCustomerAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const name = textValue(formData, "name");
  const email = textValue(formData, "email").toLowerCase();
  const password = textValue(formData, "password");

  if (!hasCustomerSessionSecret()) {
    return { ok: false, message: "Customer session secret is not configured." };
  }

  if (!email || !password) {
    return { ok: false, message: "Name, email, and password are required." };
  }

  const customerProfile = validateCustomerProfileInput({ name });

  if (!customerProfile.ok) {
    return { ok: false, message: customerProfile.message };
  }

  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  try {
    const user = await createUser(customerProfile.profile.name, email, password);
    await setCustomerSessionCookie(await createCustomerSessionToken(user));
    return { ok: true, message: "Account created. Redirecting..." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create account.",
    };
  }
}

export async function requestPasswordResetAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const email = textValue(formData, "email").toLowerCase();
  const genericMessage = "If an account exists, reset instructions will be sent shortly.";

  if (!email) {
    return { ok: false, message: "Email is required." };
  }

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "password-reset",
    key: await loginKey(email),
    maxAttempts: 4,
    windowMs: 15 * 60 * 1000,
  });

  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many reset requests. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const user = await getUserByEmail(email);

  if (!user) {
    await shortDelay();
    return { ok: true, message: genericMessage };
  }

  const token = await createPasswordResetToken(email);
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  const resetPath = `/account/reset-password?token=${encodeURIComponent(token)}`;
  const resetUrl = `${publicSiteUrl()}${resetPath}`;

  await notifyPasswordResetRequested({
    email: user.email,
    resetUrl,
    expiresAt,
    requestedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: showLocalPasswordResetLink()
      ? "Password reset link generated for this local app."
      : genericMessage,
    resetLink: showLocalPasswordResetLink() ? resetPath : undefined,
  };
}

export async function resetPasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const token = textValue(formData, "token");
  const password = textValue(formData, "password");
  const confirmPassword = textValue(formData, "confirmPassword");

  if (!token || !password || !confirmPassword) {
    return { ok: false, message: "Invalid request." };
  }

  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters long." };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "New password and confirmation do not match." };
  }

  const storedToken = await getPasswordResetToken(token);

  if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
    return { ok: false, message: "Invalid or expired password reset link." };
  }

  await updateUserPassword(storedToken.email, password);
  await deletePasswordResetToken(token);

  redirect("/account/login?reset=success");
}

export async function updateProfileAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireCustomerSession();
  const name = textValue(formData, "name");
  const phone = textValue(formData, "phone");
  const address = textValue(formData, "address");

  const customerProfile = validateCustomerProfileInput({ name, phone, address });

  if (!customerProfile.ok) {
    return { ok: false, message: customerProfile.message };
  }

  try {
    await updateUser(session.userId, customerProfile.profile);
    return { ok: true, message: "Profile updated." };
  } catch {
    return { ok: false, message: "Could not update profile." };
  }
}

export async function changePasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireCustomerSession();
  const currentPassword = textValue(formData, "currentPassword");
  const newPassword = textValue(formData, "newPassword");
  const confirmPassword = textValue(formData, "confirmPassword");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "Current password, new password, and confirmation are required." };
  }

  if (newPassword.length < 6) {
    return { ok: false, message: "New password must be at least 6 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation do not match." };
  }

  const user = await getUserById(session.userId);
  const validPassword = user ? await verifyPassword(currentPassword, user.passwordHash) : false;

  if (!user || !validPassword) {
    await shortDelay();
    return { ok: false, message: "Current password is incorrect." };
  }

  await updateUserPassword(user.email, newPassword);

  return { ok: true, message: "Password changed successfully." };
}

export async function logoutCustomerAction() {
  await clearCustomerSessionCookie();
  redirect("/account/login");
}
