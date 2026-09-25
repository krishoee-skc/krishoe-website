import {
  checkRateLimit,
  clearRateLimitAttempts,
  recordRateLimitAttempt,
} from "@/lib/rate-limit-store";
import { looksLikePhone, normalizeStaffPhone } from "@/lib/staff-phone";

const bucket = "login";
const maxAttempts = 6;
const windowMs = 15 * 60 * 1000;

export async function checkLoginRateLimit(key: string) {
  return checkRateLimit({ bucket, key, maxAttempts, windowMs });
}

export async function recordFailedLogin(key: string) {
  await recordRateLimitAttempt({ bucket, key, maxAttempts, windowMs });
}

export async function clearLoginRateLimit(key: string) {
  await clearRateLimitAttempts(bucket, key);
}

/**
 * The limit above is per network address, so someone who changes address
 * (mobile data, a VPN) starts again at zero. A Worker made with only a mobile
 * number has no emailed code behind the password, and mobile numbers are easy
 * to guess, so the account itself also stops taking guesses. Looser than the
 * address limit, so a worker who mistypes a few times is not locked out by it.
 */
const accountBucket = "login-account";
const accountMaxAttempts = 10;

/** The same account whichever way its identity was typed: `+977 98…`, `98-…`, `Name@Shop.com`. */
export function loginAccountKey(identifier: string) {
  const value = identifier.trim();
  if (!value) return "";
  return looksLikePhone(value) ? `phone:${normalizeStaffPhone(value)}` : `email:${value.toLowerCase()}`;
}

export async function checkAccountLoginRateLimit(identifier: string) {
  const key = loginAccountKey(identifier);
  if (!key) return { limited: false, remaining: accountMaxAttempts, retryAfterSeconds: 0 };
  return checkRateLimit({ bucket: accountBucket, key, maxAttempts: accountMaxAttempts, windowMs });
}

export async function recordFailedAccountLogin(identifier: string) {
  const key = loginAccountKey(identifier);
  if (!key) return;
  await recordRateLimitAttempt({ bucket: accountBucket, key, maxAttempts: accountMaxAttempts, windowMs });
}

export async function clearAccountLoginRateLimit(identifier: string) {
  const key = loginAccountKey(identifier);
  if (!key) return;
  await clearRateLimitAttempts(accountBucket, key);
}

/**
 * The Owner lifting a sign-in block (Settings → staff → Unlock).
 *
 * A worker who mistypes six times is blocked by the address limit, which is
 * keyed by network address, not by account — and the address is not recorded
 * anywhere the Owner could name it. So the unlock is a grant on the account:
 * for fifteen minutes the address limit is not applied to sign-ins to this
 * account (the account's own limit still is), and the account's wrong-password
 * count starts again from zero. Only the Owner can grant one.
 */
const unlockBucket = "login-unlock";

export async function grantAccountLoginUnlock(identifier: string) {
  const key = loginAccountKey(identifier);
  if (!key) return;
  await recordRateLimitAttempt({ bucket: unlockBucket, key, maxAttempts: 1, windowMs });
}

export async function hasAccountLoginUnlock(identifier: string) {
  const key = loginAccountKey(identifier);
  if (!key) return false;
  const grant = await checkRateLimit({ bucket: unlockBucket, key, maxAttempts: 1, windowMs });
  return grant.limited;
}
