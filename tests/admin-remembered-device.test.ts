import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { REMEMBERED_SESSION_MAX_AGE, getAdminSessionMaxAge, sessionMaxAge } from "@/lib/admin-session";

/**
 * Eight hours is right for a machine other people can reach, and wrong for the
 * phone in the owner's pocket. On that phone it means signing in again —
 * password, wait for an emailed code, type six digits — most days, to check an
 * order while standing on the factory floor.
 */
describe("staying signed in", () => {
  it("keeps the short session as the default", () => {
    expect(sessionMaxAge(false)).toBe(getAdminSessionMaxAge());
  });

  it("lasts a month only when it is asked for", () => {
    expect(sessionMaxAge(true)).toBe(REMEMBERED_SESSION_MAX_AGE);
    expect(REMEMBERED_SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });

  it("is offered unticked, and says whose device it is for", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    const start = form.indexOf('type="checkbox"');
    const box = form.slice(start, start + 800);

    // No defaultChecked: a month-long session on a shared computer has to be a
    // decision, not something that happens to someone.
    expect(box).not.toContain("defaultChecked");
    expect(box).toContain("अरूले चलाउने यन्त्रमा नटिक्नुहोस्");
  });
});

describe("one lifetime, three places", () => {
  it("gives the record, the token and the cookie the same expiry", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const complete = actions.slice(
      actions.indexOf("async function completeStaffLogin"),
      actions.indexOf("export async function"),
    );

    // Read three times, they would drift the day one learned about the tick box
    // and the others did not — leaving a cookie outliving the session behind it.
    expect(complete).toContain("const maxAge = sessionMaxAge(remember)");
    expect(complete).toContain("expiresInSeconds: maxAge");
    expect(complete).toContain("maxAge,\n    ),");
  });

  it("carries the answer across the two-step round trip", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");

    // The box is ticked on the first screen; the session is not created until
    // after the second.
    expect(actions).toContain('const remember = formData.get("remember") === "on"');
    expect(form).toContain('<input type="hidden" name="remember" value="on" />');
    // And asking for a new code must not silently untick it.
    expect(form).toContain("state.remember ?? false");
  });
});

/**
 * A longer session is not a weaker one: two-step still runs when it expires,
 * and the session can be ended from Login devices at any time.
 */
describe("what a remembered device does not change", () => {
  it("still runs two-step when the session ends", async () => {
    const actions = await readFile("app/admin/login/actions.ts", "utf8");
    const code = actions.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    // The check is on the account, never on how long the last session lasted.
    expect(code).toContain("if (staff.mfaEnabled) {");
    expect(code).not.toMatch(/remember[\s\S]{0,40}mfaEnabled/);
  });
})
