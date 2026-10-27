import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeTrustedDevice, encodeTrustedDevice } from "@/lib/admin-trusted-device";

/**
 * The trusted-device cookie (owner, 2026-10-27): signed, tied to one account and
 * one sign-in, and over after thirty days.
 */
describe("the trusted-device cookie", () => {
  const before = process.env.ADMIN_SESSION_SECRET;
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "a-test-secret-that-is-long-enough-1234567890";
  });
  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = before;
  });

  const now = Date.parse("2026-10-27T10:00:00Z");
  const device = { staffId: "owner-1", sessionId: "session-9", exp: now + 30 * 86_400_000 };

  it("reads back what it wrote", () => {
    expect(decodeTrustedDevice(encodeTrustedDevice(device), now)).toEqual(device);
  });

  it("refuses one that has run out", () => {
    expect(decodeTrustedDevice(encodeTrustedDevice({ ...device, exp: now - 1 }), now)).toBeNull();
  });

  it("refuses one that was altered", () => {
    const [payload, signature] = encodeTrustedDevice(device).split(".");
    const forged = Buffer.from(JSON.stringify({ ...device, staffId: "someone-else" })).toString("base64url");
    expect(decodeTrustedDevice(`${forged}.${signature}`, now)).toBeNull();
    expect(decodeTrustedDevice(`${payload}.x${signature.slice(1)}`, now)).toBeNull();
    expect(decodeTrustedDevice("", now)).toBeNull();
  });

  it("is never valid without the session secret", () => {
    const value = encodeTrustedDevice(device);
    process.env.ADMIN_SESSION_SECRET = "";
    expect(decodeTrustedDevice(value, now)).toBeNull();
  });
});
