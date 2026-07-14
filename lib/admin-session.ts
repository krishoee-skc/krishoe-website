import { constantTimeEqual } from "@/lib/session-security";
import { adminRoles, type AdminRole } from "@/lib/admin-role-permissions";

export const adminSessionCookieName = "krishoe_admin_session";

export type AdminSessionPayload = {
  sub: "admin";
  exp: number;
  staffId?: string;
  name?: string;
  email?: string;
  role?: AdminRole;
  branchId?: string;
};

const encoder = new TextEncoder();

function base64UrlEncode(value: string | ArrayBuffer) {
  const buffer =
    typeof value === "string"
      ? Buffer.from(value, "utf8")
      : Buffer.from(new Uint8Array(value));

  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

const MINIMUM_SECRET_LENGTH = 32;
let secretWarningShown = false;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";

  if (secret.length < MINIMUM_SECRET_LENGTH) {
    if (!secretWarningShown) {
      secretWarningShown = true;
      console.warn(
        secret.length === 0
          ? "[admin-session] ADMIN_SESSION_SECRET is not set. Admin login is disabled until you add a strong secret (at least 32 characters) to .env.local."
          : `[admin-session] ADMIN_SESSION_SECRET is too short (${secret.length} characters). It must be at least ${MINIMUM_SECRET_LENGTH} characters. Admin login is disabled until this is fixed.`,
      );
    }
    return "";
  }

  return secret;
}

export function getAdminSessionMaxAge() {
  const configuredValue = Number(process.env.ADMIN_SESSION_TTL_SECONDS);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 60 * 60 * 8;
}

async function hmac(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncode(signature);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (adminRoles as readonly string[]).includes(value);
}

function parseAdminSessionPayload(value: unknown): AdminSessionPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.sub !== "admin") {
    return null;
  }

  if (typeof candidate.exp !== "number" || !Number.isFinite(candidate.exp)) {
    return null;
  }

  if (
    !isOptionalString(candidate.staffId) ||
    !isOptionalString(candidate.name) ||
    !isOptionalString(candidate.email) ||
    !isOptionalString(candidate.branchId)
  ) {
    return null;
  }

  if (candidate.role !== undefined && !isAdminRole(candidate.role)) {
    return null;
  }

  return {
    sub: "admin",
    exp: candidate.exp,
    staffId: candidate.staffId,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    branchId: candidate.branchId,
  };
}

type AdminSessionOptions = Omit<Partial<AdminSessionPayload>, "sub" | "exp">;

export async function createAdminSessionToken(options: AdminSessionOptions = {}) {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "admin",
      exp: Date.now() + getAdminSessionMaxAge() * 1000,
      ...options,
    }),
  );
  const signature = await hmac(payload);

  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string): Promise<AdminSessionPayload | null> {
  if (!token || !getSessionSecret()) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await hmac(payload);

  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const session = parseAdminSessionPayload(JSON.parse(base64UrlDecode(payload)));

    if (session && session.exp > Date.now()) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}
