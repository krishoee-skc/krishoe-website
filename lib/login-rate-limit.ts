import {
  checkRateLimit,
  clearRateLimitAttempts,
  recordRateLimitAttempt,
} from "@/lib/rate-limit-store";

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
