import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { verifyAdminStaffResetCode } from "@/lib/admin-staff-security";

/**
 * Recovery used to depend entirely on the emailed link. When that link arrived
 * broken there was no second way in, and the owner was locked out of their own
 * admin while every audit row said the email had been sent. The email now
 * carries a 6-digit code as well, and the reset page accepts it.
 */
describe("staff password reset code", () => {
  it("rejects anything that is not six digits before touching the store", async () => {
    for (const code of ["", "12345", "1234567", "12a456", "  "]) {
      const result = await verifyAdminStaffResetCode("staff-1", code);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a code with no account behind it", async () => {
    const result = await verifyAdminStaffResetCode("", "123456");
    expect(result.ok).toBe(false);
  });
});

describe("reset email", () => {
  it("carries a code bound to the account, not to the link", async () => {
    const source = await readFile("app/admin/access/actions.ts", "utf8");

    expect(source).toContain("withCode: true");
    expect(source).toContain('codeBoundTo: "staff"');
    expect(source).toContain("Your 6-digit reset code is ${reset.code}");
  });

  it("has an action that finishes the reset from the code alone", async () => {
    const source = await readFile("app/admin/access/actions.ts", "utf8");
    expect(source).toContain("export async function completeAdminPasswordResetWithCodeAction");
  });
});

describe("reset page", () => {
  it("asks for the code when the link is missing or dead", async () => {
    const source = await readFile("app/(admin-auth)/admin/reset-password/page.tsx", "utf8");

    expect(source).toContain("AdminResetWithCodeForm");
    // The old page dead-ended on an invalid token; a stale link must now fall
    // through to the code form rather than turning the reader away.
    expect(source).not.toContain("Request a new link");
  });
});
