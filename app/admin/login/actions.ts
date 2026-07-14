"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { getConfiguredAdminRole } from "@/lib/admin-permissions";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import { clearAdminSessionCookie, getAdminSession, setAdminSessionCookie } from "@/lib/admin-auth";
import { authenticateAdminStaff } from "@/lib/admin-settings";
import { createAdminSessionToken } from "@/lib/admin-session";
import { constantTimeEqual } from "@/lib/session-security";

export type LoginState = {
  ok: boolean;
  message: string;
};

const invalidState: LoginState = {
  ok: false,
  message: "Invalid admin email or password.",
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

export async function loginAdminAction(_previousState: LoginState, formData: FormData) {
  const email = textValue(formData, "email");
  const password = textValue(formData, "password");
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const key = await loginKey();
  const rateLimit = await checkLoginRateLimit(key);

  if (!sessionSecret) {
    return {
      ok: false,
      message: "Admin session secret is not configured.",
    };
  }

  if (rateLimit.limited) {
    await appendAdminAuditEvent(
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
    const staff = await authenticateAdminStaff(email, password);

    if (!staff) {
      await recordFailedLogin(key);
      await appendAdminAuditEvent(
        "login_failed",
        `Invalid staff login attempt for ${email}.`,
        "warning",
        { actorEmail: email },
      );
      await shortDelay();
      return invalidState;
    }

    await clearLoginRateLimit(key);
    await setAdminSessionCookie(
      await createAdminSessionToken({
        staffId: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        branchId: staff.branchId,
      }),
    );
    await appendAdminAuditEvent(
      "login_success",
      `Staff ${staff.name} signed in with ${staff.role} role.`,
      "success",
      {
        actorId: staff.id,
        actorName: staff.name,
        actorEmail: staff.email,
        actorRole: staff.role,
        actorBranchId: staff.branchId,
      },
    );

    return { ok: true, message: "Login successful. Redirecting..." };
  }

  if (!expectedPassword) {
    return {
      ok: false,
      message: "Admin password is not configured. Use a staff account or set ADMIN_PASSWORD.",
    };
  }

  if (!constantTimeEqual(password, expectedPassword)) {
    await recordFailedLogin(key);
    await appendAdminAuditEvent(
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
  await appendAdminAuditEvent(
    "login_success",
    "Admin session created.",
    "success",
    { actorName: "Bootstrap admin", actorRole: getConfiguredAdminRole() },
  );

  return { ok: true, message: "Login successful. Redirecting..." };
}

export async function logoutAdminAction() {
  const session = await getAdminSession();

  if (session) {
    await appendAdminAuditEvent("logout", "Admin session cleared.");
  }

  await clearAdminSessionCookie();
  redirect("/admin/login");
}
