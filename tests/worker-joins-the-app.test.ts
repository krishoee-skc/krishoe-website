import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { generateJoinCode, joinMessage, spacedCode, whatsappNumberFor, workerPasswordProblem, WORKER_PASSWORD_MIN } from "@/lib/worker-join";

const read = (file: string) => readFile(file, "utf8");

/** Owner, 2026-10-02: "how do I bring my worker into the app — by mobile or Gmail?" */
describe("a worker joins the app from their own row", () => {
  it("makes an eight-digit code, fresh each time", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    for (const code of codes) expect(code).toMatch(/^\d{8}$/);
    expect(codes.size).toBeGreaterThan(15);
    expect(spacedCode("48271593")).toBe("4827 1593");
  });

  it("writes the WhatsApp message with the link, the number and the code, to a Nepali number", () => {
    const message = joinMessage({ name: "Ram", phone: "984-123-4567", code: "48271593", loginUrl: "https://www.krishoe.com/worker/login" });
    expect(message).toContain("https://www.krishoe.com/worker/login");
    expect(message).toContain("984-123-4567");
    expect(message).toContain("4827 1593");
    expect(whatsappNumberFor("984-123-4567")).toBe("9779841234567");
    expect(whatsappNumberFor("+977 9841234567")).toBe("9779841234567");
  });

  it("lets a worker keep an eight-character password, but not an obvious one or their own number", () => {
    expect(WORKER_PASSWORD_MIN).toBe(8);
    expect(workerPasswordProblem("chappal7")).toBe("");
    expect(workerPasswordProblem("abc12")).toContain("8");
    expect(workerPasswordProblem("12345678")).not.toBe("");
    expect(workerPasswordProblem("aaaaaaaa")).not.toBe("");
    expect(workerPasswordProblem("9841234567", "9841234567")).not.toBe("");
  });

  it("keeps twelve for every other role", async () => {
    const settings = await read("lib/admin-settings.ts");
    expect(settings).toContain('const minimum = staff.role === "Worker" ? WORKER_PASSWORD_MIN : 12;');
    const access = await read("app/admin/access/actions.ts");
    expect(access).toContain('account?.role === "Worker" ? { phone: account.phone ?? "" } : undefined');
  });

  it("is Owner/Admin only, asks for the mobile (an email if they have one), and never keeps the code", async () => {
    const actions = await read("app/admin/factory/workers/actions.ts");
    // join, new code, and (2026-10-04) an email for a worker already in
    expect(actions.match(/requireAdminPermission\("settings:write"\)/g)?.length).toBe(3);
    expect(actions).toContain('role: "Worker"');
    expect(actions).toContain("temporaryPassword: true");
    expect(actions).toContain("The code is not recorded.");
    expect(actions).toContain("revokeAllAdminStaffSessions(");
    const page = await read("app/admin/factory/workers/page.tsx");
    expect(page).toContain('canAdmin(getSessionAdminRole(session), "settings:write")');
  });
});
