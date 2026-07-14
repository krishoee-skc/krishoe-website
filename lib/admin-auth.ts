import { cookies } from "next/headers";
import {
  adminSessionCookieName,
  getAdminSessionMaxAge,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from "@/lib/admin-session";

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;
  return verifyAdminSessionToken(token);
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
    path: "/",
    maxAge: 0,
  });
}
