import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const PAGE = "app/(admin-auth)/admin/login/link/page.tsx";
const BUTTON = "app/(admin-auth)/admin/login/link/EmailLinkSignIn.tsx";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * Typing a six-digit code is slowest exactly where it is needed most: on a
 * phone, it means leaving the shop, opening the inbox, reading the digits,
 * coming back, and typing them before they expire. The owner spent eleven
 * minutes in that loop. The emailed link removes the typing.
 */
describe("the sign-in link in the two-step email", () => {
  it("is in the email", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    expect(actions).toContain("/admin/login/link?t=");
    expect(actions).toContain("On a phone, open this instead of typing it");
  });

  it("lives where an unauthenticated visitor can reach it", async () => {
    // app/admin/layout.tsx redirects anyone without a session straight to the
    // login page. A sign-in link underneath it would bounce every person it was
    // sent to — which is precisely who has no session yet.
    await expect(access(PAGE)).resolves.toBeUndefined();
    await expect(access("app/admin/login/link/page.tsx")).rejects.toThrow();
  });
});

/**
 * The rule this page exists to keep.
 *
 * Mail providers and link scanners fetch every URL in a message to build a
 * preview. A session created by a machine reading an inbox is a session nobody
 * asked for, so opening the link must not sign anyone in — it may only look the
 * token up and offer a button.
 */
describe("opening the link", () => {
  it("does not sign anyone in on the way in", async () => {
    const page = code(await readFile(PAGE, "utf8"));

    expect(page).toContain("emailLinkStillValid");
    // The three ways a session could be created, none of which belong on a GET.
    expect(page).not.toContain("signInFromEmailLinkAction");
    expect(page).not.toContain("completeStaffLogin");
    expect(page).not.toContain("setAdminSessionCookie");
  });

  it("checks without spending the token", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const peek = actions.slice(actions.indexOf("export async function emailLinkStillValid"));

    // getValidAdminStaffToken reads; verifyAdminStaffMfaCode marks it used.
    expect(peek.slice(0, 260)).toContain("getValidAdminStaffToken");
    expect(peek.slice(0, 260)).not.toContain("verifyAdminStaffMfaCode");
  });

  it("spends it only when a person presses the button", async () => {
    const button = await readFile(BUTTON, "utf8");
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const signIn = actions.slice(actions.indexOf("export async function signInFromEmailLinkAction"));

    expect(button).toContain('"use client"');
    expect(button).toContain("signInFromEmailLinkAction");
    // Marking the token used is what makes a link work once.
    expect(signIn.slice(0, 900)).toContain("verifyAdminStaffMfaCode(token, code)");
  });
});

describe("what the link is worth to someone who is not its owner", () => {
  it("expires with the code it was built from", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    // Built from the same challenge, so it inherits the ten minutes, and asking
    // for a new code voids it exactly as it voids the old digits.
    expect(actions).toContain("expiresInMinutes: 10");
    expect(actions).toContain("challenge.token");
  });

  it("is kept out of search results", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("robots: { index: false, follow: false }");
  });

  it("leaves a record either way", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");

    expect(actions).toContain('"login_mfa_link_used"');
    expect(actions).toContain('"login_mfa_link_failed"');
  });
});

describe("when the link is old", () => {
  it("says so plainly instead of failing at the button", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("यो link अब चल्दैन");
    expect(page).toContain("/admin/login");
  });
});
