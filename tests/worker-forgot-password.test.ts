import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-04 (option 2): a worker who forgot the password tells the
 * owner from the sign-in page, and a new code comes on WhatsApp; a worker with
 * an email may also reset it by email, on the worker's version of the page —
 * eight characters, their words, back to their sign-in.
 */
describe("a worker who forgot the password", () => {
  it("tells the owner from the sign-in page, which changes nothing and says nothing about the account", async () => {
    const help = await read("components/WorkerForgotHelp.tsx");
    expect(help).toContain("tellOwnerWorkerForgotAction(typed)");
    expect(help).toContain('href="/admin/forgot-password?for=worker"');
    const login = await read("components/AdminLoginForm.tsx");
    expect(login).toContain("<WorkerForgotHelp />");
    const actions = await read("app/admin/access/actions.ts");
    const tell = actions.slice(actions.indexOf("export async function tellOwnerWorkerForgotAction"));
    expect(tell).toContain('staff.role !== "Worker" || staff.status !== "Active"');
    expect(tell).toContain("maxAttempts: 3");
    expect(tell).not.toMatch(/updateAdminStaffPassword|revokeAll/);
    // the same answer whether or not an account was found
    expect(tell.match(/return told;/g)?.length).toBe(3);
  });

  it("holds a worker's emailed reset to the worker's rule, and sends them back to their own sign-in", async () => {
    const actions = await read("app/admin/access/actions.ts");
    expect(actions).toContain('const passwordResult = await validateNewPassword(formData, holder?.role === "Worker" ? { phone: holder.phone ?? "" } : undefined);');
    expect(actions).toContain('const passwordResult = await validateNewPassword(formData, staff.role === "Worker" ? { phone: staff.phone ?? "" } : undefined);');
    expect(actions.match(/href: updated\.role === "Worker" \? "\/worker\/login" : "\/admin\/login"/g)?.length).toBe(2);
    expect(actions).toContain('const forWorker = staff.role === "Worker" ? "&for=worker" : "";');
  });

  it("shows the worker's version of the email pages", async () => {
    const forms = await read("components/admin/AdminAccessForms.tsx");
    expect(forms).toContain("const least = forWorker ? 8 : 12;");
    expect(forms).toContain('text("8+ characters", "कम्तीमा ८ अक्षर")');
    expect(await read("app/(admin-auth)/admin/forgot-password/page.tsx")).toContain('const forWorker = (await searchParams).for === "worker";');
    expect(await read("app/(admin-auth)/admin/reset-password/page.tsx")).toContain('const forWorker = params.for === "worker";');
  });
});
