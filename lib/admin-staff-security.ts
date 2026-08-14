import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "@/lib/atomic-json";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

export type AdminStaffTokenPurpose = "invitation" | "password_reset" | "mfa_login";

type StaffTokenRecord = {
  id: string;
  staffId: string;
  purpose: AdminStaffTokenPurpose;
  tokenHash: string;
  secretHash: string;
  expiresAt: string;
  usedAt?: string;
  attemptCount: number;
  createdBy: string;
  createdAt: string;
};

export type AdminStaffSessionRecord = {
  id: string;
  staffId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string;
  revokedBy: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  mfaVerified: boolean;
  active: boolean;
};

export type AdminStaffAccessHistoryEntry = {
  id: string;
  staffId: string;
  action: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
};

type SecurityStore = {
  tokens: StaffTokenRecord[];
  sessions: AdminStaffSessionRecord[];
  history: AdminStaffAccessHistoryEntry[];
};

type StaffTokenRow = {
  id: string;
  staff_id: string;
  purpose: AdminStaffTokenPurpose;
  token_hash: string;
  secret_hash: string;
  expires_at: Date | string;
  used_at: Date | string | null;
  attempt_count: number;
  created_by: string;
  created_at: Date | string;
};

type StaffSessionRow = {
  id: string;
  staff_id: string;
  created_at: Date | string;
  last_seen_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  revoked_by: string;
  ip_address: string;
  user_agent: string;
  device_label: string;
  mfa_verified: boolean;
  active: boolean;
};

type AccessHistoryRow = {
  id: string;
  staff_id: string;
  action: string;
  before_state: unknown;
  after_state: unknown;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  ip_address: string;
  user_agent: string;
  created_at: Date | string;
};

const securityFile = path.join(process.cwd(), "data", "admin-staff-security.json");
const tokenPrefix = "sha256:";
const maxLocalHistory = 1_000;

function nowIso() {
  return new Date().toISOString();
}

function isoDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function hashValue(value: string) {
  return `${tokenPrefix}${createHash("sha256").update(value).digest("hex")}`;
}

function secretHash(token: string, secret: string) {
  return hashValue(`${token}:${secret}`);
}

/**
 * A code the holder can present without the raw token.
 *
 * MFA codes are bound to the token because the browser still holds the
 * challenge token when the code is typed. A password reset code is typed on a
 * fresh page — often on a different device from the one that asked for it — so
 * the only thing the person has is their email address and the six digits. The
 * code is therefore bound to the account instead, and guessing is held down by
 * the five-attempt cap on the row and the rate limit on the action.
 */
function staffCodeHash(staffId: string, code: string) {
  return hashValue(`staff:${staffId}:${code}`);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tokenFromRow(row: StaffTokenRow): StaffTokenRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    secretHash: row.secret_hash,
    expiresAt: new Date(row.expires_at).toISOString(),
    usedAt: isoDate(row.used_at),
    attemptCount: Math.max(0, Number(row.attempt_count) || 0),
    createdBy: row.created_by ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function sessionFromRow(row: StaffSessionRow): AdminStaffSessionRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    createdAt: new Date(row.created_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: isoDate(row.revoked_at),
    revokedBy: row.revoked_by ?? "",
    ipAddress: row.ip_address ?? "",
    userAgent: row.user_agent ?? "",
    deviceLabel: row.device_label ?? "Unknown device",
    mfaVerified: Boolean(row.mfa_verified),
    active: Boolean(row.active),
  };
}

function historyFromRow(row: AccessHistoryRow): AdminStaffAccessHistoryEntry {
  return {
    id: row.id,
    staffId: row.staff_id,
    action: row.action,
    beforeState: cleanRecord(row.before_state),
    afterState: cleanRecord(row.after_state),
    actorId: row.actor_id ?? "",
    actorEmail: row.actor_email ?? "",
    actorRole: row.actor_role ?? "",
    ipAddress: row.ip_address ?? "",
    userAgent: row.user_agent ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normalizeLocalStore(value: unknown): SecurityStore {
  const source = cleanRecord(value);
  return {
    tokens: Array.isArray(source.tokens) ? (source.tokens as StaffTokenRecord[]) : [],
    sessions: Array.isArray(source.sessions)
      ? (source.sessions as AdminStaffSessionRecord[])
      : [],
    history: Array.isArray(source.history)
      ? (source.history as AdminStaffAccessHistoryEntry[])
      : [],
  };
}

async function readLocalStore(): Promise<SecurityStore> {
  try {
    return normalizeLocalStore(JSON.parse(await readFile(securityFile, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { tokens: [], sessions: [], history: [] };
    }
    throw error;
  }
}

async function writeLocalStore(store: SecurityStore) {
  await writeFileAtomic(securityFile, `${JSON.stringify(store, null, 2)}\n`);
}

export function adminDeviceLabel(userAgent: string) {
  const agent = userAgent.toLowerCase();
  const browser = agent.includes("edg/")
    ? "Edge"
    : agent.includes("chrome/") && !agent.includes("crios/")
      ? "Chrome"
      : agent.includes("crios/")
        ? "Chrome iOS"
        : agent.includes("safari/")
          ? "Safari"
          : agent.includes("firefox/")
            ? "Firefox"
            : "Browser";
  const device = agent.includes("iphone")
    ? "iPhone"
    : agent.includes("ipad")
      ? "iPad"
      : agent.includes("android")
        ? "Android"
        : agent.includes("windows")
          ? "Windows PC"
          : agent.includes("mac os") || agent.includes("macintosh")
            ? "Mac"
            : "Device";

  return `${browser} on ${device}`;
}

export async function createAdminStaffToken(
  staffId: string,
  purpose: AdminStaffTokenPurpose,
  options: {
    expiresInMinutes: number;
    createdBy?: string;
    withCode?: boolean;
    codeBoundTo?: "token" | "staff";
  },
) {
  const rawToken = randomBytes(32).toString("hex");
  const code = options.withCode ? randomInt(100_000, 1_000_000).toString() : "";
  const stamp = nowIso();
  const record: StaffTokenRecord = {
    id: randomUUID(),
    staffId,
    purpose,
    tokenHash: hashValue(rawToken),
    secretHash: !code
      ? ""
      : options.codeBoundTo === "staff"
        ? staffCodeHash(staffId, code)
        : secretHash(rawToken, code),
    expiresAt: new Date(Date.now() + options.expiresInMinutes * 60_000).toISOString(),
    attemptCount: 0,
    createdBy: options.createdBy?.trim() ?? "",
    createdAt: stamp,
  };

  await runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      store.tokens = store.tokens.filter(
        (token) => token.staffId !== staffId || token.purpose !== purpose || token.usedAt,
      );
      store.tokens.unshift(record);
      await writeLocalStore(store);
    },
    postgres: () => transactionPostgres("admin settings", async (db) => {
      await db.query(
        `DELETE FROM admin_staff_tokens
         WHERE staff_id = $1 AND purpose = $2 AND used_at IS NULL`,
        [staffId, purpose],
      );
      await db.query(
        `INSERT INTO admin_staff_tokens (
           id, staff_id, purpose, token_hash, secret_hash, expires_at,
           attempt_count, created_by, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8)`,
        [
          record.id,
          record.staffId,
          record.purpose,
          record.tokenHash,
          record.secretHash,
          new Date(record.expiresAt),
          record.createdBy,
          new Date(record.createdAt),
        ],
      );
    }),
  });

  return { token: rawToken, code, expiresAt: record.expiresAt };
}

async function findLocalToken(rawToken: string, purpose: AdminStaffTokenPurpose) {
  const store = await readLocalStore();
  const tokenHash = hashValue(rawToken.trim());
  return store.tokens.find(
    (token) =>
      token.tokenHash === tokenHash &&
      token.purpose === purpose &&
      !token.usedAt &&
      new Date(token.expiresAt).getTime() > Date.now(),
  );
}

async function findPostgresToken(rawToken: string, purpose: AdminStaffTokenPurpose) {
  const rows = await queryPostgres<StaffTokenRow>(
    "admin settings",
    `SELECT id, staff_id, purpose, token_hash, secret_hash, expires_at, used_at,
       attempt_count, created_by, created_at
     FROM admin_staff_tokens
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [hashValue(rawToken.trim()), purpose],
  );
  return rows[0] ? tokenFromRow(rows[0]) : undefined;
}

export async function getValidAdminStaffToken(
  rawToken: string,
  purpose: AdminStaffTokenPurpose,
) {
  if (!rawToken.trim()) return null;
  const record = await runWithDataBackend({
    storeName: "admin settings",
    localJson: () => findLocalToken(rawToken, purpose),
    postgres: () => findPostgresToken(rawToken, purpose),
  });
  return record ? { staffId: record.staffId, expiresAt: record.expiresAt } : null;
}

export async function consumeAdminStaffToken(
  rawToken: string,
  purpose: Exclude<AdminStaffTokenPurpose, "mfa_login">,
) {
  if (!rawToken.trim()) return null;
  const tokenHash = hashValue(rawToken.trim());

  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      const index = store.tokens.findIndex(
        (token) =>
          token.tokenHash === tokenHash &&
          token.purpose === purpose &&
          !token.usedAt &&
          new Date(token.expiresAt).getTime() > Date.now(),
      );
      if (index < 0) return null;
      store.tokens[index] = { ...store.tokens[index], usedAt: nowIso() };
      await writeLocalStore(store);
      return { staffId: store.tokens[index].staffId };
    },
    postgres: async () => {
      const rows = await queryPostgres<{ staff_id: string }>(
        "admin settings",
        `UPDATE admin_staff_tokens
         SET used_at = now()
         WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
         RETURNING staff_id`,
        [tokenHash, purpose],
      );
      return rows[0] ? { staffId: rows[0].staff_id } : null;
    },
  });
}

export async function verifyAdminStaffMfaCode(rawToken: string, code: string) {
  const cleanToken = rawToken.trim();
  const cleanCode = code.trim();
  if (!cleanToken || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false as const, reason: "Enter the 6-digit security code." };
  }
  const tokenHash = hashValue(cleanToken);

  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      const index = store.tokens.findIndex(
        (token) =>
          token.tokenHash === tokenHash && token.purpose === "mfa_login" && !token.usedAt,
      );
      if (index < 0 || new Date(store.tokens[index].expiresAt).getTime() <= Date.now()) {
        return { ok: false as const, reason: "Security code expired. Sign in again." };
      }
      const record = store.tokens[index];
      if (record.attemptCount >= 5) {
        return { ok: false as const, reason: "Too many incorrect codes. Sign in again." };
      }
      if (!safeEqual(record.secretHash, secretHash(cleanToken, cleanCode))) {
        store.tokens[index] = { ...record, attemptCount: record.attemptCount + 1 };
        await writeLocalStore(store);
        return { ok: false as const, reason: "Incorrect security code." };
      }
      store.tokens[index] = { ...record, usedAt: nowIso() };
      await writeLocalStore(store);
      return { ok: true as const, staffId: record.staffId };
    },
    postgres: () => transactionPostgres("admin settings", async (db) => {
      const rows = await db.query<StaffTokenRow>(
        `SELECT id, staff_id, purpose, token_hash, secret_hash, expires_at, used_at,
           attempt_count, created_by, created_at
         FROM admin_staff_tokens
         WHERE token_hash = $1 AND purpose = 'mfa_login' AND used_at IS NULL
         FOR UPDATE`,
        [tokenHash],
      );
      const record = rows[0] ? tokenFromRow(rows[0]) : undefined;
      if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
        return { ok: false as const, reason: "Security code expired. Sign in again." };
      }
      if (record.attemptCount >= 5) {
        return { ok: false as const, reason: "Too many incorrect codes. Sign in again." };
      }
      if (!safeEqual(record.secretHash, secretHash(cleanToken, cleanCode))) {
        await db.query(
          "UPDATE admin_staff_tokens SET attempt_count = attempt_count + 1 WHERE id = $1",
          [record.id],
        );
        return { ok: false as const, reason: "Incorrect security code." };
      }
      await db.query("UPDATE admin_staff_tokens SET used_at = now() WHERE id = $1", [record.id]);
      return { ok: true as const, staffId: record.staffId };
    }),
  });
}

/**
 * Redeems a password reset code typed on the reset page.
 *
 * Looks the row up by account rather than by token, because the person holding
 * the code may never have opened the emailed link at all — the code has to work
 * on a phone that only ever saw the six digits.
 */
export async function verifyAdminStaffResetCode(staffId: string, code: string) {
  const cleanCode = code.trim();
  if (!staffId.trim() || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false as const, reason: "Enter the 6-digit code from the email." };
  }
  const expected = staffCodeHash(staffId, cleanCode);

  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      const index = store.tokens.findIndex(
        (token) =>
          token.staffId === staffId && token.purpose === "password_reset" && !token.usedAt,
      );
      if (index < 0 || new Date(store.tokens[index].expiresAt).getTime() <= Date.now()) {
        return { ok: false as const, reason: "This code has expired. Request a new one." };
      }
      const record = store.tokens[index];
      if (record.attemptCount >= 5) {
        return { ok: false as const, reason: "Too many incorrect codes. Request a new one." };
      }
      if (!record.secretHash || !safeEqual(record.secretHash, expected)) {
        store.tokens[index] = { ...record, attemptCount: record.attemptCount + 1 };
        await writeLocalStore(store);
        return { ok: false as const, reason: "Incorrect code." };
      }
      store.tokens[index] = { ...record, usedAt: nowIso() };
      await writeLocalStore(store);
      return { ok: true as const, staffId: record.staffId };
    },
    postgres: () => transactionPostgres("admin settings", async (db) => {
      const rows = await db.query<StaffTokenRow>(
        `SELECT id, staff_id, purpose, token_hash, secret_hash, expires_at, used_at,
           attempt_count, created_by, created_at
         FROM admin_staff_tokens
         WHERE staff_id = $1 AND purpose = 'password_reset' AND used_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [staffId],
      );
      const record = rows[0] ? tokenFromRow(rows[0]) : undefined;
      if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
        return { ok: false as const, reason: "This code has expired. Request a new one." };
      }
      if (record.attemptCount >= 5) {
        return { ok: false as const, reason: "Too many incorrect codes. Request a new one." };
      }
      if (!record.secretHash || !safeEqual(record.secretHash, expected)) {
        await db.query(
          "UPDATE admin_staff_tokens SET attempt_count = attempt_count + 1 WHERE id = $1",
          [record.id],
        );
        return { ok: false as const, reason: "Incorrect code." };
      }
      await db.query("UPDATE admin_staff_tokens SET used_at = now() WHERE id = $1", [record.id]);
      return { ok: true as const, staffId: record.staffId };
    }),
  });
}

export async function createAdminStaffSession(input: {
  staffId: string;
  expiresInSeconds: number;
  ipAddress?: string;
  userAgent?: string;
  mfaVerified: boolean;
}) {
  const stamp = nowIso();
  const userAgent = input.userAgent?.slice(0, 500) ?? "";
  const record: AdminStaffSessionRecord = {
    id: randomUUID(),
    staffId: input.staffId,
    createdAt: stamp,
    lastSeenAt: stamp,
    expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString(),
    revokedBy: "",
    ipAddress: input.ipAddress?.slice(0, 120) ?? "",
    userAgent,
    deviceLabel: adminDeviceLabel(userAgent),
    mfaVerified: input.mfaVerified,
    active: true,
  };

  await runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      store.sessions.unshift(record);
      await writeLocalStore(store);
    },
    postgres: async () => {
      await queryPostgres<{ id: string }>(
        "admin settings",
        `INSERT INTO admin_staff_sessions (
           id, staff_id, created_at, last_seen_at, expires_at, revoked_by,
           ip_address, user_agent, device_label, mfa_verified
         )
         VALUES ($1, $2, $3, $4, $5, '', $6, $7, $8, $9)
         RETURNING id`,
        [
          record.id,
          record.staffId,
          new Date(record.createdAt),
          new Date(record.lastSeenAt),
          new Date(record.expiresAt),
          record.ipAddress,
          record.userAgent,
          record.deviceLabel,
          record.mfaVerified,
        ],
      );
    },
  });

  return record;
}

export async function validateAdminStaffSession(sessionId: string, staffId: string) {
  if (!sessionId || !staffId) return false;

  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      const index = store.sessions.findIndex(
        (session) => session.id === sessionId && session.staffId === staffId,
      );
      if (index < 0) return false;
      const session = store.sessions[index];
      if (session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return false;
      if (Date.now() - new Date(session.lastSeenAt).getTime() > 5 * 60_000) {
        store.sessions[index] = { ...session, lastSeenAt: nowIso() };
        await writeLocalStore(store);
      }
      return true;
    },
    postgres: async () => {
      const rows = await queryPostgres<{ id: string }>(
        "admin settings",
        `UPDATE admin_staff_sessions
         SET last_seen_at = CASE
           WHEN last_seen_at < now() - interval '5 minutes' THEN now()
           ELSE last_seen_at
         END
         WHERE id = $1 AND staff_id = $2 AND revoked_at IS NULL AND expires_at > now()
         RETURNING id`,
        [sessionId, staffId],
      );
      return rows.length > 0;
    },
  });
}

export async function listAdminStaffSessions(staffId?: string) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      return store.sessions
        .filter((session) => !staffId || session.staffId === staffId)
        .map((session) => ({
          ...session,
          active: !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now(),
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    postgres: async () => {
      const params = staffId ? [staffId] : [];
      const rows = await queryPostgres<StaffSessionRow>(
        "admin settings",
        `SELECT id, staff_id, created_at, last_seen_at, expires_at, revoked_at,
           revoked_by, ip_address, user_agent, device_label, mfa_verified,
           (revoked_at IS NULL AND expires_at > now()) AS active
         FROM admin_staff_sessions
         ${staffId ? "WHERE staff_id = $1" : ""}
         ORDER BY created_at DESC
         LIMIT 300`,
        params,
      );
      return rows.map(sessionFromRow);
    },
  });
}

export async function revokeAdminStaffSession(sessionId: string, revokedBy: string) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      const index = store.sessions.findIndex((session) => session.id === sessionId);
      if (index < 0) return false;
      store.sessions[index] = {
        ...store.sessions[index],
        revokedAt: store.sessions[index].revokedAt ?? nowIso(),
        revokedBy: revokedBy.trim(),
      };
      await writeLocalStore(store);
      return true;
    },
    postgres: async () => {
      const rows = await queryPostgres<{ id: string }>(
        "admin settings",
        `UPDATE admin_staff_sessions
         SET revoked_at = COALESCE(revoked_at, now()), revoked_by = $2
         WHERE id = $1
         RETURNING id`,
        [sessionId, revokedBy.trim()],
      );
      return rows.length > 0;
    },
  });
}

export async function revokeAllAdminStaffSessions(staffId: string, revokedBy: string) {
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      let count = 0;
      store.sessions = store.sessions.map((session) => {
        if (session.staffId !== staffId || session.revokedAt) return session;
        count += 1;
        return { ...session, revokedAt: nowIso(), revokedBy: revokedBy.trim() };
      });
      await writeLocalStore(store);
      return count;
    },
    postgres: async () => {
      const rows = await queryPostgres<{ id: string }>(
        "admin settings",
        `UPDATE admin_staff_sessions
         SET revoked_at = now(), revoked_by = $2
         WHERE staff_id = $1 AND revoked_at IS NULL
         RETURNING id`,
        [staffId, revokedBy.trim()],
      );
      return rows.length;
    },
  });
}

export async function recordAdminStaffAccessHistory(input: {
  staffId: string;
  action: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const entry: AdminStaffAccessHistoryEntry = {
    id: randomUUID(),
    staffId: input.staffId,
    action: input.action.trim(),
    beforeState: input.beforeState ?? {},
    afterState: input.afterState ?? {},
    actorId: input.actorId?.trim() ?? "",
    actorEmail: input.actorEmail?.trim() ?? "",
    actorRole: input.actorRole?.trim() ?? "",
    ipAddress: input.ipAddress?.trim() ?? "",
    userAgent: input.userAgent?.slice(0, 500) ?? "",
    createdAt: nowIso(),
  };

  await runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      store.history = [entry, ...store.history].slice(0, maxLocalHistory);
      await writeLocalStore(store);
    },
    postgres: async () => {
      await queryPostgres<{ id: string }>(
        "admin settings",
        `INSERT INTO admin_staff_access_history (
           id, staff_id, action, before_state, after_state,
           actor_id, actor_email, actor_role, ip_address, user_agent, created_at
         )
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          entry.id,
          entry.staffId,
          entry.action,
          JSON.stringify(entry.beforeState),
          JSON.stringify(entry.afterState),
          entry.actorId,
          entry.actorEmail,
          entry.actorRole,
          entry.ipAddress,
          entry.userAgent,
          new Date(entry.createdAt),
        ],
      );
    },
  });

  return entry;
}

export async function getAdminStaffAccessHistory(staffId?: string, limit = 100) {
  const safeLimit = Math.min(300, Math.max(1, Math.trunc(limit) || 100));
  return runWithDataBackend({
    storeName: "admin settings",
    localJson: async () => {
      const store = await readLocalStore();
      return store.history
        .filter((entry) => !staffId || entry.staffId === staffId)
        .slice(0, safeLimit);
    },
    postgres: async () => {
      const params = staffId ? [staffId, safeLimit] : [safeLimit];
      const rows = await queryPostgres<AccessHistoryRow>(
        "admin settings",
        `SELECT id, staff_id, action, before_state, after_state,
           actor_id, actor_email, actor_role, ip_address, user_agent, created_at
         FROM admin_staff_access_history
         ${staffId ? "WHERE staff_id = $1" : ""}
         ORDER BY created_at DESC
         LIMIT $${staffId ? 2 : 1}`,
        params,
      );
      return rows.map(historyFromRow);
    },
  });
}
