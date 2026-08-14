import { createHash, randomBytes, randomInt } from "crypto";
import { promises as fs } from "fs";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export type PasswordResetToken = {
  token: string;
  email: string;
  expiresAt: string;
  /** Hash of the 6-digit code emailed alongside the link; "" for older rows. */
  codeHash?: string;
  /** Wrong codes tried against this token. Five is the ceiling. */
  attemptCount?: number;
};

type PasswordResetTokenRow = {
  token: string;
  email: string;
  expires_at: Date | string;
  code_hash?: string | null;
  attempt_count?: number | null;
};

const dataDir = path.join(process.cwd(), "data");
const tokensFile = path.join(dataDir, "password-reset-tokens.json");
const hashedTokenPrefix = "sha256:";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashResetToken(token: string) {
  return `${hashedTokenPrefix}${createHash("sha256").update(token).digest("hex")}`;
}

function hashResetCode(email: string, code: string) {
  return `${hashedTokenPrefix}${createHash("sha256").update(`${email}:${code}`).digest("hex")}`;
}

async function getPasswordResetTokenByEmailFromLocalJson(email: string) {
  const tokens = await readTokensFromLocalJson();
  return tokens.find((item) => normalizeEmail(item.email) === normalizeEmail(email)) ?? null;
}

async function getPasswordResetTokenByEmailFromPostgres(email: string) {
  const rows = await queryPostgres<PasswordResetTokenRow>(
    "password reset tokens",
    `
      SELECT token, email, expires_at, code_hash, attempt_count
      FROM password_reset_tokens
      WHERE lower(email) = lower($1)
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return rows[0] ? tokenFromRow(rows[0]) : null;
}

async function countFailedCodeAttemptInLocalJson(token: string) {
  const tokens = await readTokensFromLocalJson();
  const index = tokens.findIndex((item) => item.token === token);
  if (index < 0) return;
  tokens[index] = { ...tokens[index], attemptCount: (tokens[index].attemptCount ?? 0) + 1 };
  await writeTokens(tokens);
}

async function countFailedCodeAttemptInPostgres(token: string) {
  await queryPostgres<{ token: string }>(
    "password reset tokens",
    `
      UPDATE password_reset_tokens
      SET attempt_count = attempt_count + 1
      WHERE token = $1
      RETURNING token
    `,
    [token],
  );
}

function storageResetToken(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken) {
    return cleanToken;
  }

  return cleanToken.startsWith(hashedTokenPrefix) ? cleanToken : hashResetToken(cleanToken);
}

function resetTokenLookupCandidates(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken) {
    return [];
  }

  return cleanToken.startsWith(hashedTokenPrefix) ? [cleanToken] : [hashResetToken(cleanToken), cleanToken];
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function tokenFromRow(row: PasswordResetTokenRow): PasswordResetToken {
  return {
    token: row.token,
    email: row.email,
    expiresAt: isoDate(row.expires_at),
    codeHash: row.code_hash ?? "",
    attemptCount: Math.max(0, Number(row.attempt_count) || 0),
  };
}

async function readTokensFromLocalJson(): Promise<PasswordResetToken[]> {
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

async function readTokensFromPostgres(): Promise<PasswordResetToken[]> {
  const rows = await queryPostgres<PasswordResetTokenRow>(
    "password reset tokens",
    `
      SELECT token, email, expires_at, code_hash, attempt_count
      FROM password_reset_tokens
      ORDER BY expires_at DESC
    `,
  );

  return rows.map(tokenFromRow);
}

async function readTokens(): Promise<PasswordResetToken[]> {
  return runWithDataBackend({
    storeName: "password reset tokens",
    localJson: readTokensFromLocalJson,
    postgres: readTokensFromPostgres,
  });
}

async function writeTokens(tokens: PasswordResetToken[]) {
  await writeFileAtomic(tokensFile, JSON.stringify(tokens, null, 2) + "\n");
}

async function createPasswordResetTokenInLocalJson(record: PasswordResetToken): Promise<void> {
  const tokens = await readTokensFromLocalJson();
  const updatedTokens = tokens.filter((token) => normalizeEmail(token.email) !== normalizeEmail(record.email));
  updatedTokens.push(record);

  await writeTokens(updatedTokens);
}

async function createPasswordResetTokenInPostgres(record: PasswordResetToken): Promise<void> {
  const users = await queryPostgres<{ email: string }>(
    "password reset tokens",
    "SELECT email FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [record.email],
  );
  const canonicalEmail = users[0]?.email;

  if (!canonicalEmail) {
    throw new Error("User not found.");
  }

  await queryPostgres<{ token: string }>(
    "password reset tokens",
    "DELETE FROM password_reset_tokens WHERE lower(email) = lower($1) RETURNING token",
    [canonicalEmail],
  );

  await queryPostgres<{ token: string }>(
    "password reset tokens",
    `
      INSERT INTO password_reset_tokens (token, email, expires_at, code_hash, attempt_count)
      VALUES ($1, $2, $3, $4, 0)
      RETURNING token
    `,
    [record.token, canonicalEmail, new Date(record.expiresAt), record.codeHash ?? null],
  );
}

/**
 * Issues a reset token and the six-digit code that travels beside it.
 *
 * The code is bound to the account, not to the token, because it is typed on a
 * page that has neither — someone who asked on a laptop and reads the email on
 * a phone has only their address and the digits. It is hashed exactly like the
 * token; nothing here can be replayed out of the database.
 */
export async function createPasswordResetToken(email: string): Promise<{ token: string; code: string }> {
  const expiresAt = new Date(Date.now() + 3600 * 1000);
  const rawToken = randomBytes(32).toString("hex");
  const normalizedEmail = normalizeEmail(email);
  const code = randomInt(100_000, 1_000_000).toString();
  const record: PasswordResetToken = {
    token: hashResetToken(rawToken),
    email: normalizedEmail,
    expiresAt: expiresAt.toISOString(),
    codeHash: hashResetCode(normalizedEmail, code),
    attemptCount: 0,
  };

  await runWithDataBackend({
    storeName: "password reset tokens",
    localJson: () => createPasswordResetTokenInLocalJson(record),
    postgres: () => createPasswordResetTokenInPostgres(record),
  });

  return { token: rawToken, code };
}

/**
 * Redeems the emailed code. Returns the account it belongs to, or the reason it
 * was refused — never both, and never a hint about which half was wrong.
 */
export async function verifyPasswordResetCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const cleanCode = code.trim();

  if (!normalizedEmail || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false as const, reason: "Enter the 6-digit code from the email." };
  }

  const record = await runWithDataBackend({
    storeName: "password reset tokens",
    localJson: () => getPasswordResetTokenByEmailFromLocalJson(normalizedEmail),
    postgres: () => getPasswordResetTokenByEmailFromPostgres(normalizedEmail),
  });

  if (!record || new Date(record.expiresAt) < new Date()) {
    return { ok: false as const, reason: "That code has expired. Ask for a new one." };
  }
  if ((record.attemptCount ?? 0) >= 5) {
    return { ok: false as const, reason: "Too many incorrect codes. Ask for a new one." };
  }
  if (!record.codeHash || record.codeHash !== hashResetCode(normalizedEmail, cleanCode)) {
    await runWithDataBackend({
      storeName: "password reset tokens",
      localJson: () => countFailedCodeAttemptInLocalJson(record.token),
      postgres: () => countFailedCodeAttemptInPostgres(record.token),
    });
    return { ok: false as const, reason: "Incorrect code." };
  }

  return { ok: true as const, email: record.email, token: record.token };
}

async function getPasswordResetTokenFromLocalJson(token: string): Promise<PasswordResetToken | null> {
  const candidates = resetTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return null;
  }

  const tokens = await readTokensFromLocalJson();
  return tokens.find((item) => candidates.includes(item.token)) ?? null;
}

async function getPasswordResetTokenFromPostgres(token: string): Promise<PasswordResetToken | null> {
  const candidates = resetTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return null;
  }

  const rows = await queryPostgres<PasswordResetTokenRow>(
    "password reset tokens",
    `
      SELECT token, email, expires_at, code_hash, attempt_count
      FROM password_reset_tokens
      WHERE token = ANY($1::text[])
      ORDER BY array_position($1::text[], token)
      LIMIT 1
    `,
    [candidates],
  );

  return rows[0] ? tokenFromRow(rows[0]) : null;
}

export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  return runWithDataBackend({
    storeName: "password reset tokens",
    localJson: () => getPasswordResetTokenFromLocalJson(token),
    postgres: () => getPasswordResetTokenFromPostgres(token),
  });
}

export async function getPasswordResetTokensForBackup(): Promise<PasswordResetToken[]> {
  const tokens = await readTokens();

  return tokens.map((token) => ({
    ...token,
    token: storageResetToken(token.token),
  }));
}

async function deletePasswordResetTokenFromLocalJson(token: string): Promise<void> {
  const candidates = resetTokenLookupCandidates(token);
  const tokens = await readTokensFromLocalJson();
  const updatedTokens = tokens.filter((item) => !candidates.includes(item.token));
  await writeTokens(updatedTokens);
}

async function deletePasswordResetTokenFromPostgres(token: string): Promise<void> {
  const candidates = resetTokenLookupCandidates(token);

  if (candidates.length === 0) {
    return;
  }

  await queryPostgres<{ token: string }>(
    "password reset tokens",
    "DELETE FROM password_reset_tokens WHERE token = ANY($1::text[]) RETURNING token",
    [candidates],
  );
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  return runWithDataBackend({
    storeName: "password reset tokens",
    localJson: () => deletePasswordResetTokenFromLocalJson(token),
    postgres: () => deletePasswordResetTokenFromPostgres(token),
  });
}
