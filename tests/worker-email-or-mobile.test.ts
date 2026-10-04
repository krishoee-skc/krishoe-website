import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { phoneLookupCandidates } from "@/lib/staff-phone";

const read = (file: string) => readFile(file, "utf8");

/**
 * Owner, 2026-10-04: an Indian worker could not open the app — the account
 * had his mobile only, and he tried his Gmail. A worker now opens it with the
 * mobile or the email, and the mobile with or without its country code.
 */
describe("a worker opens the app with the mobile or the email", () => {
  it("finds a number with or without its country code", () => {
    expect(phoneLookupCandidates("+91 98765 43210")).toEqual(expect.arrayContaining(["919876543210", "9876543210"]));
    expect(phoneLookupCandidates("9876543210")).toEqual(expect.arrayContaining(["9876543210", "919876543210"]));
    expect(phoneLookupCandidates("+977 9841112222")[0]).toBe("9841112222");
    expect(phoneLookupCandidates("hello")).toEqual([]);
  });

  it("takes the number exactly as typed first, and refuses a guess between two accounts", async () => {
    const settings = await read("lib/admin-settings.ts");
    expect(settings).toContain("WHERE phone = ANY($1::text[])");
    expect(settings).toContain("if (rows.length === 2 && normalizeStaffPhone(rows[0].phone ?? \"\") !== candidates[0]) return undefined;");
  });

  it("asks for an email when joining, and lets one be added later, never one already in use", async () => {
    const actions = await read("app/admin/factory/workers/actions.ts");
    expect(actions).toContain("export async function joinWorkerToAppAction(workerId: string, phoneInput: string, emailInput = \"\")");
    expect(actions).toContain("export async function setWorkerEmailAction(workerId: string, emailInput: string)");
    expect(actions).toContain("This email already signs in as");
    const panel = await read("app/admin/factory/workers/WorkerAppPanel.tsx");
    expect(panel).toContain('text("Add email", "Email थप्ने")');
  });
});
