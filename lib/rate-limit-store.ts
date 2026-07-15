import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { transactionPostgres, type PostgresExecutor } from "@/lib/postgres/client";

type RateLimitAttemptRecord = {
  bucket: string;
  keyHash: string;
  attempts: number[];
};

type RateLimitOptions = {
  bucket: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
};

type RateLimitCheck = {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitAttemptRow = {
  attempted_at: Date | string;
};

const dataDirectory = path.join(process.cwd(), "data");
const attemptsPath = path.join(dataDirectory, "rate-limit-attempts.json");
const storeName = "rate limit attempts";

function hashKey(bucket: string, key: string) {
  return createHash("sha256").update(`${bucket}:${key}`).digest("hex");
}

function freshAttempts(attempts: number[], windowMs: number, now = Date.now()) {
  return attempts.filter((attemptedAt) => now - attemptedAt < windowMs);
}

function resultFromAttempts(attempts: number[], maxAttempts: number, windowMs: number, now = Date.now()): RateLimitCheck {
  if (attempts.length < maxAttempts) {
    return {
      limited: false,
      remaining: Math.max(0, maxAttempts - attempts.length),
      retryAfterSeconds: 0,
    };
  }

  const oldestAttempt = Math.min(...attempts);
  return {
    limited: true,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldestAttempt)) / 1000)),
  };
}

async function readLocalRecords() {
  try {
    const content = await readFile(attemptsPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? (parsed as RateLimitAttemptRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeLocalRecords(records: RateLimitAttemptRecord[]) {
  await writeFileAtomic(attemptsPath, `${JSON.stringify(records, null, 2)}\n`);
}

async function checkLocalRateLimit({ bucket, key, maxAttempts, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const keyHash = hashKey(bucket, key);
  const records = await readLocalRecords();
  const record = records.find((item) => item.bucket === bucket && item.keyHash === keyHash);
  const attempts = record ? freshAttempts(record.attempts, windowMs, now) : [];

  return resultFromAttempts(attempts, maxAttempts, windowMs, now);
}

async function recordLocalRateLimitAttempt({ bucket, key, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const keyHash = hashKey(bucket, key);
  const records = await readLocalRecords();
  const existingIndex = records.findIndex((item) => item.bucket === bucket && item.keyHash === keyHash);
  const attempts =
    existingIndex >= 0 ? freshAttempts(records[existingIndex].attempts, windowMs, now) : [];
  const nextRecord = { bucket, keyHash, attempts: [...attempts, now] };

  if (existingIndex >= 0) {
    records[existingIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  await writeLocalRecords(records.filter((item) => item.attempts.length > 0));
}

async function clearLocalRateLimitAttempts(bucket: string, key: string) {
  const keyHash = hashKey(bucket, key);
  const records = await readLocalRecords();
  await writeLocalRecords(records.filter((item) => item.bucket !== bucket || item.keyHash !== keyHash));
}

async function withPostgresAttempts<T>(
  { bucket, key, windowMs }: Omit<RateLimitOptions, "maxAttempts">,
  callback: (context: {
    attempts: number[];
    db: PostgresExecutor;
    keyHash: string;
    now: number;
  }) => Promise<T>,
) {
  const now = Date.now();
  const keyHash = hashKey(bucket, key);
  const cutoff = new Date(now - windowMs);

  return transactionPostgres(storeName, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [bucket, keyHash]);
    await db.query(
      "DELETE FROM rate_limit_attempts WHERE bucket = $1 AND key_hash = $2 AND attempted_at < $3",
      [bucket, keyHash, cutoff],
    );
    const rows = await db.query<RateLimitAttemptRow>(
      `
        SELECT attempted_at
        FROM rate_limit_attempts
        WHERE bucket = $1 AND key_hash = $2
        ORDER BY attempted_at ASC
      `,
      [bucket, keyHash],
    );
    const attempts = rows.map((row) => new Date(row.attempted_at).getTime());

    return callback({ attempts, db, keyHash, now });
  });
}

async function checkPostgresRateLimit(options: RateLimitOptions) {
  return withPostgresAttempts(options, async ({ attempts }) =>
    resultFromAttempts(attempts, options.maxAttempts, options.windowMs),
  );
}

async function recordPostgresRateLimitAttempt(options: RateLimitOptions) {
  await withPostgresAttempts(options, async ({ db, keyHash, now }) => {
    await db.query(
      `
        INSERT INTO rate_limit_attempts (bucket, key_hash, attempted_at)
        VALUES ($1, $2, $3)
      `,
      [options.bucket, keyHash, new Date(now)],
    );
  });
}

async function clearPostgresRateLimitAttempts(bucket: string, key: string) {
  const keyHash = hashKey(bucket, key);

  await transactionPostgres(storeName, async (db) => {
    await db.query("DELETE FROM rate_limit_attempts WHERE bucket = $1 AND key_hash = $2", [
      bucket,
      keyHash,
    ]);
  });
}

async function checkAndRecordPostgresRateLimit(options: RateLimitOptions) {
  return withPostgresAttempts(options, async ({ attempts, db, keyHash, now }) => {
    const currentResult = resultFromAttempts(attempts, options.maxAttempts, options.windowMs, now);

    if (currentResult.limited) {
      return currentResult;
    }

    await db.query(
      `
        INSERT INTO rate_limit_attempts (bucket, key_hash, attempted_at)
        VALUES ($1, $2, $3)
      `,
      [options.bucket, keyHash, new Date(now)],
    );

    return resultFromAttempts([...attempts, now], options.maxAttempts, options.windowMs, now);
  });
}

export async function checkRateLimit(options: RateLimitOptions) {
  return runWithDataBackend({
    storeName,
    localJson: () => checkLocalRateLimit(options),
    postgres: () => checkPostgresRateLimit(options),
  });
}

export async function recordRateLimitAttempt(options: RateLimitOptions) {
  return runWithDataBackend({
    storeName,
    localJson: () => recordLocalRateLimitAttempt(options),
    postgres: () => recordPostgresRateLimitAttempt(options),
  });
}

export async function clearRateLimitAttempts(bucket: string, key: string) {
  return runWithDataBackend({
    storeName,
    localJson: () => clearLocalRateLimitAttempts(bucket, key),
    postgres: () => clearPostgresRateLimitAttempts(bucket, key),
  });
}

export async function checkAndRecordRateLimit(options: RateLimitOptions) {
  return runWithDataBackend({
    storeName,
    localJson: async () => {
      const currentResult = await checkLocalRateLimit(options);

      if (currentResult.limited) {
        return currentResult;
      }

      await recordLocalRateLimitAttempt(options);
      const nextResult = await checkLocalRateLimit(options);

      return {
        ...nextResult,
        limited: false,
      };
    },
    postgres: () => checkAndRecordPostgresRateLimit(options),
  });
}
