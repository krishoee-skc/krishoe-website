import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The owner could not sign in on their phone, and the app gave them nothing to
 * go on.
 *
 * The audit trail says what happened: a successful sign-in on one device, then
 * a single wrong password on the phone nine minutes later, then two password
 * resets. Nothing in the code stops a phone — there is no device check anywhere,
 * and sessions end only at logout, so one account is signed in on a computer and
 * a phone at the same time by design. What was missing was any explanation.
 */
describe("signing in with a passkey on a device that has none", () => {
  it("says so instead of sitting in silence", async () => {
    const source = await readFile("components/PasskeySignInButton.tsx", "utf8");

    // A browser with no passkey saved offers to scan a QR from another device,
    // and dismissing that sheet throws the same NotAllowedError as cancelling a
    // fingerprint prompt. Both were being swallowed, so the button appeared to
    // do nothing at all.
    expect(source).toContain('name === "NotAllowedError" || name === "AbortError"');
    // The wording changed after the owner hit this on their iPhone: "passkey
    // दर्ता छैन" was accurate and left them stuck, because it never said that
    // registration is per-device or where it happens. What has to hold is that
    // the message explains rather than merely reports.
    expect(source).toContain("यो फोनमा अझै चालु छैन");
    expect(source).toContain("हरेक यन्त्रमा एक पटक मिलाउनुपर्छ");
    // And it points at the way in that does work.
    expect(source).toContain("password");
  });
});

describe("the sign-in field on a phone keyboard", () => {
  it("is not capitalised or autocorrected on the way in", async () => {
    const source = await readFile("components/AdminLoginForm.tsx", "utf8");
    // The window has to reach past the comment explaining why these are here.
    const field = source.slice(source.indexOf('inputMode="email"'), source.indexOf('type="password"'));

    expect(field).toContain('autoCapitalize="none"');
    expect(field).toContain('autoCorrect="off"');
    expect(field).toContain("spellCheck={false}");
  });
});

/**
 * One account, every device. The shop is run from a computer at the desk and a
 * phone on the factory floor, and customers arrive on whatever they own.
 */
describe("what may sign in", () => {
  it("never turns anyone away for the device they are holding", async () => {
    for (const file of [
      "app/admin/login/actions.ts",
      "lib/admin-auth.ts",
      "components/AdminLoginForm.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

      expect(code, file).not.toMatch(/isMobile|mobileBlocked|desktopOnly/);
    }
  });

  it("ends a session when someone signs out, not when they sign in elsewhere", async () => {
    const source = await readFile("app/admin/login/actions.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // Counted where it is called, not where it is imported.
    const revocations = [...code.matchAll(/await revokeAdminStaffSession\(/g)];

    // The only call is inside logoutAdminAction. Signing in on a phone must not
    // push the computer out, or the shop can only ever be open in one place.
    expect(revocations.length).toBe(1);
    expect(code.slice(code.indexOf("export async function logoutAdminAction"))).toContain(
      "revokeAdminStaffSession"
    );
  });
});
