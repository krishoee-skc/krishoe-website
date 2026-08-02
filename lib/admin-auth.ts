import { cookies } from "next/headers";
import {
  adminSessionCookieName,
  getAdminSessionMaxAge,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from "@/lib/admin-session";
import { validateAdminStaffSession } from "@/lib/admin-staff-security";
import { activateAdminBranchContext } from "@/lib/admin-branch-context";

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;
  const session = await verifyAdminSessionToken(token);

  if (!session) return null;

  // Every real staff login must be backed by the device/session registry.
  // Rejecting pre-registry staff cookies makes password resets, access changes,
  // account locks, and manual device logout effective immediately.
  if (session.staffId && !session.sessionId) return null;

  if (session.staffId && session.sessionId) {
    const active = await validateAdminStaffSession(session.sessionId, session.staffId);
    if (!active) return null;
  }

  activateAdminBranchContext({
    branchId: session.branchId ?? "",
    // Real staff accounts, including Owners, operate inside their selected
    // branch. The legacy environment-password bootstrap has no staff/branch
    // identity and remains a temporary all-branch recovery account.
    bypass: !session.staffId,
    staffId: session.staffId ?? "bootstrap-owner",
  });

  return session;
}

export async function hasAdminSession(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    throw new Error("Unauthorized admin action.");
  }

  return session;
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: adminSessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    path: "/",
    maxAge: getAdminSessionMaxAge(),
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: adminSessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    path: "/",
    maxAge: 0,
  });
}
