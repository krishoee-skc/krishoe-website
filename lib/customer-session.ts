import { constantTimeEqual } from "@/lib/session-security";

export const customerSessionCookieName = "krishoe_customer_session";

export type CustomerSessionPayload = {
  sub: "customer";
  userId: string;
  email: string;
  exp: number;
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

function getSessionSecret() {
  return process.env.CUSTOMER_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "";
}

export function getCustomerSessionMaxAge() {
  const configuredValue = Number(process.env.CUSTOMER_SESSION_TTL_SECONDS);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : 60 * 60 * 24 * 30;
}

export function hasCustomerSessionSecret() {
  return Boolean(getSessionSecret());
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

export async function createCustomerSessionToken(user: { id: string; email: string }) {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: "customer",
      userId: user.id,
      email: user.email,
      exp: Date.now() + getCustomerSessionMaxAge() * 1000,
    }),
  );
  const signature = await hmac(payload);

  return `${payload}.${signature}`;
}

export async function verifyCustomerSessionToken(token?: string): Promise<CustomerSessionPayload | null> {
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
    const session = JSON.parse(base64UrlDecode(payload)) as CustomerSessionPayload;

    if (
      session.sub === "customer" &&
      typeof session.userId === "string" &&
      typeof session.email === "string" &&
      typeof session.exp === "number" &&
      session.exp > Date.now()
    ) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}
