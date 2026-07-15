import { promises as fs } from "fs";
import { writeFileAtomic } from "@/lib/atomic-json";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import path from "path";
import { promisify } from "node:util";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  phone?: string;
  address?: string;
};

export type SafeUser = Omit<User, "passwordHash">;

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date | string;
  phone: string | null;
  address: string | null;
};

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");
const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(storedHash, "hex");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanRequiredText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function cleanOptionalText(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: isoDate(row.created_at),
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
  };
}

async function readUsersFromLocalJson(): Promise<User[]> {
  try {
    const content = await fs.readFile(usersFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readUsersFromPostgres(): Promise<User[]> {
  const rows = await queryPostgres<UserRow>(
    "users",
    `
      SELECT id, name, email, password_hash, created_at, phone, address
      FROM users
      ORDER BY created_at DESC
    `,
  );

  return rows.map(userFromRow);
}

async function readUsers(): Promise<User[]> {
  return runWithDataBackend({
    storeName: "users",
    localJson: readUsersFromLocalJson,
    postgres: readUsersFromPostgres,
  });
}

async function writeUsers(users: User[]) {
  await writeFileAtomic(usersFile, JSON.stringify(users, null, 2) + "\n");
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    phone: user.phone,
    address: user.address,
  };
}

async function getUserByIdFromLocalJson(id: string): Promise<User | undefined> {
  const users = await readUsersFromLocalJson();
  return users.find((user) => user.id === id);
}

async function getUserByIdFromPostgres(id: string): Promise<User | undefined> {
  const rows = await queryPostgres<UserRow>(
    "users",
    `
      SELECT id, name, email, password_hash, created_at, phone, address
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? userFromRow(rows[0]) : undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  return runWithDataBackend({
    storeName: "users",
    localJson: () => getUserByIdFromLocalJson(id),
    postgres: () => getUserByIdFromPostgres(id),
  });
}

export async function getSafeUserById(id: string): Promise<SafeUser | null> {
  const user = await getUserById(id);
  return user ? toSafeUser(user) : null;
}

export async function getUsersForBackup(): Promise<User[]> {
  return readUsers();
}

async function getUserByEmailFromLocalJson(email: string): Promise<User | undefined> {
  const normalizedEmail = normalizeEmail(email);
  const users = await readUsersFromLocalJson();
  return users.find((user) => normalizeEmail(user.email) === normalizedEmail);
}

async function getUserByEmailFromPostgres(email: string): Promise<User | undefined> {
  const rows = await queryPostgres<UserRow>(
    "users",
    `
      SELECT id, name, email, password_hash, created_at, phone, address
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return rows[0] ? userFromRow(rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return runWithDataBackend({
    storeName: "users",
    localJson: () => getUserByEmailFromLocalJson(email),
    postgres: () => getUserByEmailFromPostgres(email),
  });
}

async function createUserInLocalJson(record: User): Promise<User> {
  const users = await readUsersFromLocalJson();
  const existingUser = users.find((user) => normalizeEmail(user.email) === normalizeEmail(record.email));

  if (existingUser) {
    throw new Error("User with this email already exists.");
  }

  users.unshift(record);
  await writeUsers(users);
  return record;
}

async function createUserInPostgres(record: User): Promise<User> {
  const existingUser = await getUserByEmailFromPostgres(record.email);

  if (existingUser) {
    throw new Error("User with this email already exists.");
  }

  const rows = await queryPostgres<UserRow>(
    "users",
    `
      INSERT INTO users (id, name, email, password_hash, created_at, phone, address, updated_at)
      VALUES ($1, $2, $3, $4, $5, NULL, NULL, now())
      ON CONFLICT DO NOTHING
      RETURNING id, name, email, password_hash, created_at, phone, address
    `,
    [record.id, record.name, record.email, record.passwordHash, new Date(record.createdAt)],
  );

  if (rows.length === 0) {
    throw new Error("User with this email already exists.");
  }

  return userFromRow(rows[0]);
}

export async function createUser(name: string, email: string, password: string): Promise<User> {
  const record: User = {
    id: `user-${crypto.randomUUID()}`,
    name: cleanRequiredText(name) ?? name,
    email: normalizeEmail(email),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  return runWithDataBackend({
    storeName: "users",
    localJson: () => createUserInLocalJson(record),
    postgres: () => createUserInPostgres(record),
  });
}

async function updateUserInLocalJson(
  userId: string,
  data: { name?: string; phone?: string; address?: string },
): Promise<SafeUser> {
  const users = await readUsersFromLocalJson();
  const userIndex = users.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    throw new Error("User not found.");
  }

  const user = users[userIndex];
  const nextUser: User = {
    ...user,
    name: cleanRequiredText(data.name) ?? user.name,
    phone: data.phone === undefined ? user.phone : cleanOptionalText(data.phone),
    address: data.address === undefined ? user.address : cleanOptionalText(data.address),
  };

  users[userIndex] = nextUser;
  await writeUsers(users);
  return toSafeUser(nextUser);
}

async function updateUserInPostgres(
  userId: string,
  data: { name?: string; phone?: string; address?: string },
): Promise<SafeUser> {
  const currentUser = await getUserByIdFromPostgres(userId);

  if (!currentUser) {
    throw new Error("User not found.");
  }

  const nextName = cleanRequiredText(data.name) ?? currentUser.name;
  const nextPhone = data.phone === undefined ? currentUser.phone : cleanOptionalText(data.phone);
  const nextAddress = data.address === undefined ? currentUser.address : cleanOptionalText(data.address);

  const rows = await queryPostgres<UserRow>(
    "users",
    `
      UPDATE users
      SET name = $2, phone = $3, address = $4, updated_at = now()
      WHERE id = $1
      RETURNING id, name, email, password_hash, created_at, phone, address
    `,
    [userId, nextName, nextPhone ?? null, nextAddress ?? null],
  );

  if (rows.length === 0) {
    throw new Error("User not found.");
  }

  return toSafeUser(userFromRow(rows[0]));
}

export async function updateUser(
  userId: string,
  data: { name?: string; phone?: string; address?: string },
): Promise<SafeUser | undefined> {
  return runWithDataBackend({
    storeName: "users",
    localJson: () => updateUserInLocalJson(userId, data),
    postgres: () => updateUserInPostgres(userId, data),
  });
}

async function updateUserPasswordInLocalJson(email: string, password: string) {
  const users = await readUsersFromLocalJson();
  const userIndex = users.findIndex((user) => normalizeEmail(user.email) === normalizeEmail(email));

  if (userIndex === -1) {
    throw new Error("User not found.");
  }

  users[userIndex] = {
    ...users[userIndex],
    passwordHash: await hashPassword(password),
  };

  await writeUsers(users);
}

async function updateUserPasswordInPostgres(email: string, password: string) {
  const rows = await queryPostgres<{ id: string }>(
    "users",
    `
      UPDATE users
      SET password_hash = $2, updated_at = now()
      WHERE lower(email) = lower($1)
      RETURNING id
    `,
    [normalizeEmail(email), await hashPassword(password)],
  );

  if (rows.length === 0) {
    throw new Error("User not found.");
  }
}

export async function updateUserPassword(email: string, password: string) {
  return runWithDataBackend({
    storeName: "users",
    localJson: () => updateUserPasswordInLocalJson(email, password),
    postgres: () => updateUserPasswordInPostgres(email, password),
  });
}
