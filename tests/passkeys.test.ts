import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Signing in without a password, and telling the owner when someone signs in
 * from a device they have never used.
 *
 * These are the two halves of the same problem. A stolen password is silent and
 * works from anywhere; a passkey cannot be stolen at a distance, and the alert
 * covers the passwords still in use. Most of what is tested here is what must
 * NOT happen, because those are the properties a later change would quietly
 * remove while everything still appeared to work.
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("what a passkey is bound to", () => {
  it("takes its domain from the site address, not a separate setting", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://krishoe-website.vercel.app";
    vi.resetModules();
    const { passkeyRelyingParty } = await import("@/lib/passkeys");

    // Two settings that can disagree is the failure that produces "sign-in
    // failed" with nothing in any log to explain it.
    expect(passkeyRelyingParty()).toEqual({
      id: "krishoe-website.vercel.app",
      origin: "https://krishoe-website.vercel.app",
      name: "KRISHOE",
    });
  });

  it("uses a bare hostname, which is what WebAuthn accepts", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com:3000";
    vi.resetModules();
    const { passkeyRelyingParty } = await import("@/lib/passkeys");

    const rp = passkeyRelyingParty();
    expect(rp.id).toBe("shop.example.com");
    expect(rp.id).not.toContain(":");
    // The origin keeps the port; only the id drops it.
    expect(rp.origin).toBe("https://shop.example.com:3000");
  });
});

describe("the rules the source has to keep", () => {
  it("demands a fingerprint or PIN, never just possession", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");

    // A passkey that unlocks without verification is only a longer password,
    // and a shared counter computer would hand the shop to whoever sits down.
    expect(source).toContain('userVerification: "required"');
    expect(source).not.toContain('userVerification: "preferred"');
    expect(source).not.toContain('userVerification: "discouraged"');
    expect(source).toContain("requireUserVerification: true");
  });

  it("verifies against the challenge it stored, not the one it was sent", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");
    // The browser echoes the challenge back; trusting that copy would make the
    // whole exchange decorative.
    expect(source).toContain("expectedChallenge: stored.challenge");
    expect(source).not.toContain("expectedChallenge: response");
  });

  it("consumes a challenge so the same response cannot be replayed", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");
    expect(source).toContain("DELETE FROM admin_passkey_challenges");
    expect(source).toContain("RETURNING challenge, staff_id");
    expect(source).toContain("expires_at > now()");
  });

  it("stores only the public half of the key", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");
    const insert = source.slice(source.indexOf("INSERT INTO admin_passkeys"));

    expect(insert.slice(0, 300)).toContain("public_key");
    expect(source).not.toContain("private_key");
    expect(source).not.toContain("privateKey");
  });

  it("will not let one person delete another person's key", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");
    expect(source).toContain("DELETE FROM admin_passkeys WHERE id = $1 AND staff_id = $2");
  });

  it("refuses a registration whose challenge belongs to someone else", async () => {
    const source = await readFile("lib/passkeys.ts", "utf8");
    expect(source).toContain("stored.staff_id !== staffId");
  });
});

describe("how a passkey sign-in is recorded", () => {
  it("goes through the same completion as a password sign-in", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const passkey = await readFile("app/admin/login/passkey-actions.ts", "utf8");

    // A second path that "also logs someone in" is how one of them ends up not
    // writing an audit entry.
    expect(actions).toContain("export async function completePasskeyStaffLogin");
    expect(actions).toContain("return completeStaffLogin(staff, true, context)");
    expect(passkey).toContain("completePasskeyStaffLogin(staff)");
  });

  it("still refuses a disabled account", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    // A passkey on a suspended account must not be a way back in.
    expect(actions).toContain('staff.status !== "Active"');
  });

  it("requires an existing session before a passkey can be added", async () => {
    const passkey = await readFile("app/admin/login/passkey-actions.ts", "utf8");
    const register = passkey.slice(passkey.indexOf("startPasskeyRegistrationAction"));

    // Adding a way in has to be at least as hard as the way in already held,
    // or a borrowed unlocked laptop becomes a permanent key.
    expect(register.slice(0, 400)).toContain("getAdminSession()");
    expect(register.slice(0, 400)).toContain("पहिले login गर्नुहोस्");
  });
});

describe("the new-device alert", () => {
  it("matches on the device label, not the exact browser version", async () => {
    const source = await readFile("lib/login-alerts.ts", "utf8");
    // Otherwise every browser update would look like a new machine and alert
    // until nobody read them.
    expect(source).toContain("device_label = $2");
    expect(source).not.toContain("user_agent =");
  });

  it("ignores the session just created, or every login would look new", async () => {
    const source = await readFile("lib/login-alerts.ts", "utf8");
    expect(source).toContain("AND id <> $3");
  });

  it("sends the owner to the page where a session can be ended", async () => {
    const source = await readFile("lib/login-alerts.ts", "utf8");
    // An alert that cannot be acted on in the same breath is only worry.
    expect(source).toContain('url: "/admin/devices"');
  });

  it("never throws, so a push outage cannot block a sign-in", async () => {
    const source = await readFile("lib/login-alerts.ts", "utf8");
    expect(source).toContain("catch (error)");
    expect(source).toContain("reportError");
  });
});

describe("the sign-in button", () => {
  it("hides itself where passkeys cannot work", async () => {
    const button = await readFile("components/PasskeySignInButton.tsx", "utf8");
    const hook = await readFile("lib/use-passkey-support.ts", "utf8");

    // A button that fails when pressed teaches people to distrust the screen.
    expect(button).toContain("usePasskeySupport()");
    expect(button).toContain("if (!supported) return null");

    // The capability check itself lives in the hook. isSecureContext matters as
    // much as the API existing: WebAuthn is refused over plain http, which is
    // how the shop gets reached on a local network.
    expect(hook).toContain("window.isSecureContext");
    expect(hook).toContain("PublicKeyCredential");
  });

  it("reads the capability without an extra render", async () => {
    const hook = await readFile("lib/use-passkey-support.ts", "utf8");

    // It cannot change while the page is open, so it is not state. Through an
    // effect it rendered once as unsupported and again as supported.
    expect(hook).toContain("useSyncExternalStore");
    expect(hook).not.toContain("useEffect");
  });

  it("treats a cancelled fingerprint prompt as a change of mind", async () => {
    const source = await readFile("components/PasskeySignInButton.tsx", "utf8");
    expect(source).toContain("NotAllowedError");
    expect(source).toContain("AbortError");
  });
});

describe("the sign-in page wording", () => {
  it("calls itself one thing", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");

    // "Secure admin", "control room" and "Forgot staff password?" on one page
    // read as three different doors; the owner could not tell which they had
    // opened, and there is only one.
    expect(form).not.toContain("control room");
    expect(form).not.toContain("Secure admin");
    expect(form).not.toContain("Forgot staff password?");
    expect(form).toContain("KRISHOE Admin");
  });
});
