import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * Eleven minutes locked out of their own till, by a rule nothing stated.
 *
 * Issuing a two-step code deletes the account's previous unused one. That is
 * right — and it was invisible. The owner, trying to sign in on their phone,
 * asked for another code twice; three arrived, the first two were already dead,
 * and neither the inbox nor the screen said which of the three to type. The
 * only way out of the screen was "Start sign-in again", which threw them back
 * to the password field, where the next code killed the one they were holding.
 */
describe("asking for another two-step code", () => {
  it("can be done without leaving the code screen", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    expect(actions).toContain("export async function resendAdminMfaCodeAction");
    expect(form).toContain("resendAdminMfaCodeAction");
    expect(form).toContain("नयाँ कोड पठाउने");
  });

  it("does not make anyone retype their password to get one", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const resend = actions.slice(actions.indexOf("export async function resendAdminMfaCodeAction"));

    // A live mfa_login token is proof the password was accepted minutes ago.
    expect(resend.slice(0, 600)).toContain('getValidAdminStaffToken(challengeToken.trim(), "mfa_login")');
    expect(resend.slice(0, 600)).not.toContain("verifyAdminStaffCredentials");
  });

  it("says on screen that the older codes are dead", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");

    expect(code(form)).toContain("सबैभन्दा नयाँ मात्र चल्छ");
  });

  it("stamps the email with the time it was sent", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    // Three near-identical emails cannot be told apart on a phone, where a
    // thread stacks newest-last as often as newest-first.
    expect(actions).toContain('timeZone: "Asia/Kathmandu"');
    expect(actions).toContain("only this newest one works");
  });
});

/**
 * A wrong code left no trace at all. The audit trail showed every challenge
 * sent and not one rejection, so the eleven minutes were undiagnosable from the
 * record — the same eleven minutes would have been undiagnosable next time.
 */
describe("the record of a failed sign-in", () => {
  it("includes a rejected two-step code", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    expect(actions).toContain('"login_mfa_failed"');
  });
});

/**
 * A phone with Face ID has no fingerprint to offer. Its owner reads "औंलाको
 * छाप", looks for a sensor that is not there, and concludes the app does not
 * work on their phone.
 */
describe("how the app names the way a device recognises you", () => {
  it("does not promise a fingerprint the device may not have", async () => {
    for (const file of ["components/PasskeySignInButton.tsx", "components/admin/PasskeyManager.tsx"]) {
      expect(code(await readFile(file, "utf8")), file).not.toContain("औंलाको छाप");
    }
  });

  it("names all three, in the words the phone itself uses", async () => {
    const manager = await readFile("components/admin/PasskeyManager.tsx", "utf8");

    expect(manager).toContain("Face ID");
    expect(manager).toContain("Touch ID");
    expect(manager).toContain("PIN");
  });

  it("says a passkey belongs to one device, and what to do when it is gone", async () => {
    const manager = code(await readFile("components/admin/PasskeyManager.tsx", "utf8"));

    // The difference between a shortcut and a trap.
    expect(manager).toContain("यो यन्त्रमा मात्र बस्छ");
    expect(manager).toContain("password");
  });
});
