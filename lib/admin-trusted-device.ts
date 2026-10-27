import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * A device the owner has said is theirs, for thirty days (owner, 2026-10-27).
 *
 * After a sign-in that passed the second step (the emailed code, or a passkey)
 * with "Remember this device — 30 days" ticked, this device gets a signed
 * cookie. Until it runs out, signing in again here — after a log-out — needs
 * the password only; the emailed code is not asked. Thirty days from the code,
 * not from the last visit: then the code is asked once more.
 *
 * The cookie alone is never enough. It names the sign-in that earned it, and
 * that sign-in must still stand: logged out by its own hand is fine; signed
 * out by "Sign out all devices", by the Login devices page, or by a password
 * change ends the trust with it (see trustedSignInStillStands). Another
 * device, or the password on its own, still meets the code.
 */

export const TRUSTED_DEVICE_COOKIE = "krishoe_admin_trusted";
export const TRUSTED_DEVICE_SECONDS = 30 * 24 * 60 * 60;
export { SELF_LOGOUT } from "@/lib/admin-session-marks";

type TrustedDevice = { staffId: string; sessionId: string; exp: number };

function secret() {
  const base = process.env.ADMIN_SESSION_SECRET ?? "";
  // Never a usable key without the session secret, and never the same key as
  // the session cookie's.
  return base.length >= 32 ? `${base}:trusted-device` : "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeTrustedDevice(device: TrustedDevice) {
  const payload = Buffer.from(JSON.stringify(device)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeTrustedDevice(value: string | undefined, now = Date.now()): TrustedDevice | null {
  if (!value || !secret()) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const device = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TrustedDevice>;
    if (typeof device.staffId !== "string" || typeof device.sessionId !== "string" || typeof device.exp !== "number") return null;
    if (!device.staffId || !device.sessionId || device.exp <= now) return null;
    return { staffId: device.staffId, sessionId: device.sessionId, exp: device.exp };
  } catch {
    return null;
  }
}

/** Mark this device as trusted by the sign-in just made. */
export async function grantTrustedDevice(staffId: string, sessionId: string) {
  if (!secret()) return;
  const cookieStore = await cookies();
  cookieStore.set({
    name: TRUSTED_DEVICE_COOKIE,
    value: encodeTrustedDevice({ staffId, sessionId, exp: Date.now() + TRUSTED_DEVICE_SECONDS * 1000 }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRUSTED_DEVICE_SECONDS,
  });
}

/** This device's trust for a staff account, if it has one that has not run out. */
export async function readTrustedDevice(staffId: string) {
  const cookieStore = await cookies();
  const device = decodeTrustedDevice(cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value);
  return device && device.staffId === staffId ? device : null;
}

export async function forgetTrustedDevice() {
  const cookieStore = await cookies();
  cookieStore.set({ name: TRUSTED_DEVICE_COOKIE, value: "", path: "/", maxAge: 0 });
}
