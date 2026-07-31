"use server";

import { revalidatePath } from "next/cache";
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
import {
  notifyEmailVerificationRequested,
  notifyPasswordResetRequested,
} from "@/lib/notifications";
import {
  createCustomerSessionToken,
  hasCustomerSessionSecret,
} from "@/lib/customer-session";
import {
  createEmailVerificationToken,
  deleteEmailVerificationToken,
  getEmailVerificationToken,
} from "@/lib/email-verification-store";
import { reportError } from "@/lib/report-error";
import {
  createUser,
  getUserById,
  getUserByEmail,
  invalidateUserSessions,
  markUserEmailVerified,
  updateUser,
  updateUserPassword,
  verifyPassword,
} from "@/lib/user-store";
import {
  attachOrderToCustomer,
  getOrderById,
  orderMatchesCustomer,
} from "@/lib/submissions";
import {
  createPasswordResetToken,
  deletePasswordResetToken,
  getPasswordResetToken,
} from "@/lib/password-reset-store";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

export type AccountActionState = {
  ok: boolean;
  message: string;
  href?: string;
  resetLink?: string;
  verificationLink?: string;
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

function showLocalEmailVerificationLink() {
  return process.env.EMAIL_VERIFICATION_SHOW_LOCAL_LINK === "true" || process.env.NODE_ENV !== "production";
}

async function shortDelay() {
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
}

function passwordPolicyMessage(password: string, label = "Password") {
  if (password.length < 8) {
    return `${label} must be at least 8 characters.`;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return `${label} must include at least one letter and one number.`;
  }

  return "";
}

async function loginKey(email: string) {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const userAgent = headerStore.get("user-agent")?.slice(0, 80) ?? "unknown";

  return `customer:${email.toLowerCase()}:${forwardedFor || realIp || userAgent}`;
}

async function sendEmailVerification(user: { id: string; email: string }) {
  const token = await createEmailVerificationToken(user);
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const verificationPath = `/account/verify-email?token=${encodeURIComponent(token)}`;
  const verificationUrl = `${publicSiteUrl()}${verificationPath}`;

  await notifyEmailVerificationRequested({
    email: user.email,
    verificationUrl,
    expiresAt,
    requestedAt: new Date().toISOString(),
  });

  return verificationPath;
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
  const website = textValue(formData, "website");

  if (website) {
    await shortDelay();
    return { ok: false, message: "Could not create account." };
  }

  if (!hasCustomerSessionSecret()) {
    return { ok: false, message: "Customer session secret is not configured." };
  }

  if (!email || !password) {
    return { ok: false, message: "Name, email, and password are required." };
  }

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "customer-register",
    key: await loginKey(email),
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many account attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const customerProfile = validateCustomerProfileInput({ name });

  if (!customerProfile.ok) {
    return { ok: false, message: customerProfile.message };
  }

  const passwordMessage = passwordPolicyMessage(password);

  if (passwordMessage) {
    return { ok: false, message: passwordMessage };
  }

  try {
    const user = await createUser(customerProfile.profile.name, email, password);
    await setCustomerSessionCookie(await createCustomerSessionToken(user));
    try {
      await sendEmailVerification(user);
    } catch (error) {
      reportError(`create email verification for user ${user.id}`, error);
    }
    return { ok: true, message: "Account created. Redirecting..." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create account.",
    };
  }
}

export async function requestEmailVerificationAction(): Promise<AccountActionState> {
  const session = await requireCustomerSession();
  const user = await getUserById(session.userId);

  if (!user) {
    return { ok: false, message: "Please sign in again before verifying your email." };
  }

  if (user.emailVerifiedAt) {
    return { ok: true, message: "Your email is already verified." };
  }

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "email-verification",
    key: await loginKey(user.email),
    maxAttempts: 4,
    windowMs: 15 * 60 * 1000,
  });

  if (rateLimit.limited) {
    return {
      ok: false,
      message: `Too many verification emails. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  try {
    const verificationPath = await sendEmailVerification(user);

    return {
      ok: true,
      message: showLocalEmailVerificationLink()
        ? "Email verification link generated for this local app."
        : "Verification instructions have been sent to your email.",
      verificationLink: showLocalEmailVerificationLink() ? verificationPath : undefined,
    };
  } catch (error) {
    reportError(`send email verification for user ${user.id}`, error);
    return { ok: false, message: "Could not send verification email right now." };
  }
}

export async function confirmEmailVerificationAction(formData: FormData) {
  const token = textValue(formData, "token");

  if (!token) {
    redirect("/account/login?verified=invalid");
  }

  const storedToken = await getEmailVerificationToken(token);

  if (!storedToken || new Date(storedToken.expiresAt) < new Date()) {
    redirect("/account/login?verified=invalid");
  }

  await markUserEmailVerified(storedToken.userId, storedToken.email);
  await deleteEmailVerificationToken(token);

  const session = await requireCustomerSession().catch(() => null);

  if (session?.userId === storedToken.userId) {
    redirect("/account?verified=success");
  }

  redirect("/account/login?verified=success");
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

  const passwordMessage = passwordPolicyMessage(password);

  if (passwordMessage) {
    return { ok: false, message: passwordMessage };
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
  await clearCustomerSessionCookie();

  redirect("/account/login?reset=success");
}

export async function claimOrderAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireCustomerSession();
  const orderId = textValue(formData, "orderId").toUpperCase();

  if (!orderId || orderId.length > 80 || !/^[A-Z0-9-]+$/.test(orderId)) {
    return { ok: false, message: "Enter a valid KRISHOE order reference." };
  }

  const [user, order] = await Promise.all([
    getUserById(session.userId),
    getOrderById(orderId),
  ]);

  if (!user) {
    return { ok: false, message: "Please sign in again before linking an order." };
  }

  if (!order) {
    return { ok: false, message: "Order was not found." };
  }

  if (order.customerUserId && order.customerUserId !== user.id) {
    return { ok: false, message: "This order is already linked to another customer account." };
  }

  if (!orderMatchesCustomer(order, user)) {
    return {
      ok: false,
      message: "Verify your email or ask KRISHOE to verify your phone before linking this guest order.",
    };
  }

  try {
    const linkedOrder = await attachOrderToCustomer(order.id, user.id);
    revalidatePath("/account");
    revalidatePath(`/order/${linkedOrder.id}`);

    return {
      ok: true,
      message: "Order linked to your account.",
      href: `/order/${linkedOrder.id}`,
    };
  } catch {
    return { ok: false, message: "Could not link this order right now." };
  }
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

  const passwordMessage = passwordPolicyMessage(newPassword, "New password");

  if (passwordMessage) {
    return { ok: false, message: passwordMessage };
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

  const updatedUser = await updateUserPassword(user.email, newPassword);
  await setCustomerSessionCookie(await createCustomerSessionToken(updatedUser));

  return { ok: true, message: "Password changed successfully." };
}

export async function logoutCustomerAction() {
  await clearCustomerSessionCookie();
  redirect("/account/login");
}

export async function logoutAllCustomerSessionsAction() {
  const session = await requireCustomerSession();
  await invalidateUserSessions(session.userId);
  await clearCustomerSessionCookie();
  redirect("/account/login?session=ended");
}
