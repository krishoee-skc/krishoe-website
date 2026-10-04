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

/** Owner, 2026-10-04: any country's number, and only an account the owner made. */
describe("a worker from any country", () => {
  it("finds Dubai's and Malaysia's nine digits without the code, and India's with a leading 0", async () => {
    const { phoneLookupCandidates, formatStaffPhone } = await import("@/lib/staff-phone");
    expect(phoneLookupCandidates("501234567")).toContain("971501234567");
    expect(phoneLookupCandidates("0123456789")).toContain("60123456789");
    expect(phoneLookupCandidates("09876543210")).toContain("919876543210");
    expect(formatStaffPhone("919876543210")).toBe("+91 9876543210");
    expect(formatStaffPhone("971501234567")).toBe("+971 501234567");
    expect(formatStaffPhone("9841112222")).toBe("984-111-2222");
  });

  it("chooses the country beside the number when joining, and tells the worker both ways work", async () => {
    const panel = await read("app/admin/factory/workers/WorkerAppPanel.tsx");
    expect(panel).toContain("<PhoneWithCountry");
    const login = await read("components/AdminLoginForm.tsx");
    expect(login).toContain('"From India or another country? Type +91 … or just the number — both work."');
  });

  it("opens only an account the owner made — nobody makes their own", async () => {
    const settings = await read("lib/admin-settings.ts");
    // sign-in only ever looks an account up; it never creates one
    const lookup = settings.slice(settings.indexOf("async function getStaffByPhoneFromPostgres"), settings.indexOf("async function getStaffByPhoneFromPostgres") + 1500);
    expect(lookup).not.toMatch(/INSERT|saveAdminStaffAccount/);
  });
});
