import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export type EmailVerificationToken = {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
};

type EmailVerificationTokenRow = {
  token: string;
  user_id: string;
  email: string;
  expires_at: Date | string;
};

const dataDir = path.join(process.cwd(), "data");
const tokensFile = path.join(dataDir, "email-verification-tokens.json");
const hashedTokenPrefix = "sha256:";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashVerificationToken(token: string) {
  return `${hashedTokenPrefix}${createHash("sha256").update(token).digest("hex")}`;
}

function storageVerificationToken(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken) {
    return cleanToken;
  }

  return cleanToken.startsWith(hashedTokenPrefix) ? cleanToken : hashVerificationToken(cleanToken);
}

function verificationTokenLookupCandidates(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken) {
    return [];
  }

  return cleanToken.startsWith(hashedTokenPrefix)
    ? [cleanToken]
    : [hashVerificationToken(cleanToken), cleanToken];
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function tokenFromRow(row: EmailVerificationTokenRow): EmailVerificationToken {
  return {
    token: row.token,
    userId: row.user_id,
    email: row.email,
    expiresAt: isoDate(row.expires_at),
  };
}

async function readTokensFromLocalJson(): Promise<EmailVerificationToken[]> {
  try {
    const content = await fs.readFile(tokensFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readTokensFromPostgres(): Promise<EmailVerificationToken[]> {
  const rows = await queryPostgres<EmailVerificationTokenRow>(
    "email verification tokens",
    `
      SELECT token, user_id, email, expires_at
      FROM email_verification_tokens
      ORDER BY expires_at DESC
    `,
  );

  return rows.map(tokenFromRow);
}

async function readTokens(): Promise<EmailVerificationToken[]> {
  return runWithDataBackend({
    storeName: "email verification tokens",
    localJson: readTokensFromLocalJson,
    postgres: readTokensFromPostgres,
  });
}

async function writeTokens(tokens: EmailVerificationToken[]) {
  await writeFileAtomic(tokensFile, JSON.stringify(tokens, null, 2) + "\n");
}

async function createEmailVerificationTokenInLocalJson(
  record: EmailVerificationToken,
): Promise<void> {
  const tokens = await readTokensFromLocalJson();
  const updatedTokens = tokens.filter(
    (token) =>
      token.userId !== record.userId &&
      normalizeEmail(token.email) !== normalizeEmail(record.email),
  );
  updatedTokens.push(record);

  await writeTokens(updatedTokens);
}

async function createEmailVerificationTokenInPostgres(
  record: EmailVerificationToken,
): Promise<void> {
  const users = await queryPostgres<{ id: string; email: string }>(
    "email verification tokens",
    "SELECT id, email FROM users WHERE id = $1 AND lower(email) = lower($2) LIMIT 1",
    [record.userId, record.email],
  );
  const user = users[0];

  if (!user) {
    throw new Error("User not found.");
  }

  await queryPostgres<{ token: string }>(
    "email verification tokens",
    "DELETE FROM email_verification_tokens WHERE user_id = $1 OR lower(email) = lower($2) RETURNING token",
    [user.id, user.email],
  );

  await queryPostgres<{ token: string }>(
    "email verification tokens",
    `
      INSERT INTO email_verification_tokens (token, user_id, email, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING token
    `,
    [record.token, user.id, user.email, new Date(record.expiresAt)],
  );
}

export async function createEmailVerificationToken(user: {
  id: string;
  email: string;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  const rawToken = randomBytes(32).toString("hex");
  const record: EmailVerificationToken = {
    token: hashVerificationToken(rawToken),
    userId: user.id,
    email: normalizeEmail(user.email),
    expiresAt: expiresAt.toISOString(),
  };

  await runWithDataBackend({
    storeName: "email verification tokens",
    localJson: () => createEmailVerificationTokenInLocalJson(record),
    postgres: () => createEmailVerificationTokenInPostgres(record),
  });

  return rawToken;
}

async function getEmailVerificationTokenFromLocalJson(
  token: string,
): Promise<EmailVerificationToken | null> {
  const candidates = verificationTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return null;
  }

  const tokens = await readTokensFromLocalJson();
  return tokens.find((item) => candidates.includes(item.token)) ?? null;
}

async function getEmailVerificationTokenFromPostgres(
  token: string,
): Promise<EmailVerificationToken | null> {
  const candidates = verificationTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return null;
  }

  const rows = await queryPostgres<EmailVerificationTokenRow>(
    "email verification tokens",
    `
      SELECT token, user_id, email, expires_at
      FROM email_verification_tokens
      WHERE token = ANY($1::text[])
      ORDER BY array_position($1::text[], token)
      LIMIT 1
    `,
    [candidates],
  );

  return rows[0] ? tokenFromRow(rows[0]) : null;
}

export async function getEmailVerificationToken(
  token: string,
): Promise<EmailVerificationToken | null> {
  return runWithDataBackend({
    storeName: "email verification tokens",
    localJson: () => getEmailVerificationTokenFromLocalJson(token),
    postgres: () => getEmailVerificationTokenFromPostgres(token),
  });
}

export async function getEmailVerificationTokensForBackup(): Promise<EmailVerificationToken[]> {
  const tokens = await readTokens();

  return tokens.map((token) => ({
    ...token,
    token: storageVerificationToken(token.token),
  }));
}

async function deleteEmailVerificationTokenFromLocalJson(token: string): Promise<void> {
  const candidates = verificationTokenLookupCandidates(token);
  const tokens = await readTokensFromLocalJson();
  const updatedTokens = tokens.filter((item) => !candidates.includes(item.token));
  await writeTokens(updatedTokens);
}

async function deleteEmailVerificationTokenFromPostgres(token: string): Promise<void> {
  const candidates = verificationTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return;
  }

  await queryPostgres<{ token: string }>(
    "email verification tokens",
    "DELETE FROM email_verification_tokens WHERE token = ANY($1::text[]) RETURNING token",
    [candidates],
  );
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  return runWithDataBackend({
    storeName: "email verification tokens",
    localJson: () => deleteEmailVerificationTokenFromLocalJson(token),
    postgres: () => deleteEmailVerificationTokenFromPostgres(token),
  });
}
