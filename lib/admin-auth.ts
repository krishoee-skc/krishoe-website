import { cookies } from "next/headers";
import {
  adminSessionCookieName,
  getAdminSessionMaxAge,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from "@/lib/admin-session";
import { validateAdminStaffSession } from "@/lib/admin-staff-security";
import { activateAdminBranchContext, allBranchAdminRole } from "@/lib/admin-branch-context";

/** The cookie holding "show me only this branch". Empty means all of them. */
export const viewingBranchCookieName = "krishoe_admin_branch_view";

/**
 * The branch the admin has chosen to look at, if any.
 *
 * Deliberately not signed. It cannot grant anything: the caller only consults
 * it for somebody already entitled to every branch, and honouring it turns the
 * database bypass off rather than on. The worst a tampered value can do is show
 * its owner a branch id that matches nothing, which is an empty screen, not a
 * leak.
 */
export async function readViewingBranchId() {
  const cookieStore = await cookies();
  return (cookieStore.get(viewingBranchCookieName)?.value ?? "").trim();
}

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

  // Who may read past their own branch. Two accounts may: the legacy
  // environment-password bootstrap, which carries no staff or branch identity
  // at all, and the Owner, who owns every branch and is the one person who has
  // to be able to add them up. Staff below Owner stay inside the branch they
  // signed into, which is the whole point of the wall.
  //
  // This exemption decides nothing today. The app connects to Neon as
  // neondb_owner, a role with rolbypassrls, so Postgres skips every policy
  // before reading it and everyone already sees every branch. It matters on the
  // day the app is given a NOBYPASSRLS role — and on that day it is the
  // difference between isolation starting to work and the Owner opening an
  // empty shop, because his staff account sits in one branch and the rows sit
  // in another. The exemption is reported on the monitoring screen beside the
  // role, so it can never be mistaken for a wall that is standing.
  const seesEveryBranch = !session.staffId || session.role === allBranchAdminRole;

  // One branch at a time, when the owner has asked for that.
  //
  // Only somebody already entitled to every branch may choose, and the choice
  // can only ever narrow: it swaps the branch id every query already carries
  // and turns the bypass off, so the pages filter themselves without a single
  // screen learning a new rule. For anyone else the cookie is ignored outright
  // — a Manager posted to one branch must not reach another by pasting one.
  const viewingBranchId = seesEveryBranch ? await readViewingBranchId() : "";

  activateAdminBranchContext({
    branchId: viewingBranchId || session.branchId || "",
    // Narrowing only: a chosen branch turns this off, and nothing here can turn
    // it on for somebody who did not already have it.
    bypass: seesEveryBranch && !viewingBranchId,
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

export async function setAdminSessionCookie(
  token: string,
  maxAgeSeconds = getAdminSessionMaxAge(),
) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: adminSessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    path: "/",
    maxAge: maxAgeSeconds,
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
