import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export type PasswordResetToken = {
  token: string;
  email: string;
  expiresAt: string;
};

type PasswordResetTokenRow = {
  token: string;
  email: string;
  expires_at: Date | string;
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
      SELECT token, email, expires_at
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
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(tokensFile, JSON.stringify(tokens, null, 2) + "\n", "utf8");
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
      INSERT INTO password_reset_tokens (token, email, expires_at)
      VALUES ($1, $2, $3)
      RETURNING token
    `,
    [record.token, canonicalEmail, new Date(record.expiresAt)],
  );
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 3600 * 1000);
  const rawToken = randomBytes(32).toString("hex");
  const record: PasswordResetToken = {
    token: hashResetToken(rawToken),
    email: normalizeEmail(email),
    expiresAt: expiresAt.toISOString(),
  };

  await runWithDataBackend({
    storeName: "password reset tokens",
    localJson: () => createPasswordResetTokenInLocalJson(record),
    postgres: () => createPasswordResetTokenInPostgres(record),
  });

  return rawToken;
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
      SELECT token, email, expires_at
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
