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
