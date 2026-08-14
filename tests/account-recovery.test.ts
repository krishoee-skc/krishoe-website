import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Every way into this app used to run through one email link, and a broken link
 * meant nobody could get in. These are the second doors: a mobile sign-in for
 * workers with no inbox, an Owner-issued temporary password for recovering
 * them, and a 6-digit code for everyone who does have email.
 */
describe("mobile sign-in", () => {
  it("accepts an email or a mobile number in one field", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    // type="email" would have the browser reject a phone number before the form
    // was ever sent.
    expect(form).not.toMatch(/name="email"\s+type="email"/);
    expect(form).toContain('name="email"');
    expect(form).toContain("मोबाइल");
  });

  it("resolves whichever identity was typed", async () => {
    const source = await readFile("lib/admin-settings.ts", "utf8");
    expect(source).toContain("async function getStaffByIdentifier");
    expect(source).toContain("getStaffByPhoneFromPostgres");
    expect(source).toContain("export async function verifyAdminStaffCredentials(identifier: string");
  });

  it("counts a failed attempt against the account, not the typed identity", async () => {
    const source = await readFile("lib/admin-settings.ts", "utf8");
    const body = source.slice(source.indexOf("export async function recordAdminStaffFailedLogin"));
    // Keyed by staff id: otherwise the lockout is sidestepped by switching from
    // the email to the phone.
    expect(body).toContain("getStaffByIdentifier");
    expect(body.slice(0, body.indexOf("\n}"))).toContain("staff.id");
  });
});

describe("worker accounts without an inbox", () => {
  it("creates a mobile account with a temporary password that must be changed", async () => {
    const source = await readFile("app/admin/settings/actions.ts", "utf8");
    expect(source).toContain("temporaryPassword: true");
    expect(source).toContain('status: "Active"');
    expect(source).toContain("export async function setStaffTemporaryPasswordAction");
  });

  it("cuts every existing session when a temporary password is issued", async () => {
    const source = await readFile("app/admin/settings/actions.ts", "utf8");
    const body = source.slice(source.indexOf("export async function setStaffTemporaryPasswordAction"));
    const action = body.slice(0, body.indexOf("\n}\n"));
    expect(action).toContain("mustChangePassword: true");
    expect(action).toContain("revokeSecuritySessions");
  });

  it("requires an email or a phone, never neither", async () => {
    const source = await readFile("lib/admin-settings.ts", "utf8");
    expect(source).toContain("Staff email or mobile number is required.");
  });
});

describe("customer recovery", () => {
  it("emails a code beside the link", async () => {
    const store = await readFile("lib/password-reset-store.ts", "utf8");
    expect(store).toContain("export async function verifyPasswordResetCode");
    expect(store).toContain("randomInt(100_000, 1_000_000)");

    const notifications = await readFile("lib/notifications.ts", "utf8");
    expect(notifications).toContain("Your 6-digit reset code is ${reset.resetCode}");
  });

  it("caps guesses at five per code", async () => {
    const store = await readFile("lib/password-reset-store.ts", "utf8");
    expect(store).toContain("attemptCount ?? 0) >= 5");
  });

  it("falls through to the code form when the link is dead", async () => {
    const page = await readFile("app/account/reset-password/page.tsx", "utf8");
    expect(page).toContain("ResetPasswordWithCodeForm");
    // The old page called notFound() on a missing token, which left anyone with
    // a broken link nowhere to go.
    expect(page).not.toContain("notFound()");
  });

  it("refuses the passwords that get guessed first", async () => {
    const source = await readFile("app/account/actions.ts", "utf8");
    const body = source.slice(source.indexOf("function passwordPolicyMessage"));
    const policy = body.slice(0, body.indexOf("\n}"));
    expect(policy).toContain("qwerty");
    expect(policy).toContain("krishoe");
    expect(policy).toMatch(/\(\.\)\\1\{5,\}/);
  });
});
