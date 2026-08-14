import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  formatStaffPhone,
  isNepaliMobile,
  looksLikePhone,
  normalizeStaffPhone,
  staffSignInLabel,
} from "@/lib/staff-phone";

/**
 * A factory worker has a phone, not an inbox. Every number below is the same
 * worker; if any two normalized differently, the Owner would be able to create
 * that worker twice and the wages would split across two sign-ins.
 */
describe("normalizeStaffPhone", () => {
  it("reduces every written form of one number to the same digits", () => {
    for (const written of [
      "9841112222",
      "984-111-2222",
      "984 111 2222",
      "+977 9841112222",
      "+977-984-111-2222",
      "0097 79841112222",
      " 9841112222 ",
    ]) {
      expect(normalizeStaffPhone(written), written).toBe("9841112222");
    }
  });

  it("refuses what cannot be a number", () => {
    for (const value of ["", "   ", "abc", "12345", "owner@krishoe.com"]) {
      expect(normalizeStaffPhone(value), value).toBe("");
    }
  });

  it("leaves a local number that merely starts with 977 alone", () => {
    expect(normalizeStaffPhone("9771234567")).toBe("9771234567");
  });
});

describe("looksLikePhone", () => {
  it("sends an address to the email lookup and digits to the phone lookup", () => {
    expect(looksLikePhone("owner@krishoe.com")).toBe(false);
    expect(looksLikePhone("9841112222")).toBe(true);
    expect(looksLikePhone("+977 984-111-2222")).toBe(true);
    expect(looksLikePhone("")).toBe(false);
    expect(looksLikePhone("not a phone")).toBe(false);
  });
});

describe("display helpers", () => {
  it("groups a ten-digit number for reading", () => {
    expect(formatStaffPhone("9841112222")).toBe("984-111-2222");
  });

  it("recognises a Nepali mobile", () => {
    expect(isNepaliMobile("9841112222")).toBe(true);
    expect(isNepaliMobile("0141112222")).toBe(false);
  });

  it("labels an account by whichever identity it actually has", () => {
    expect(staffSignInLabel({ email: "a@b.com", phone: "9841112222" })).toBe("a@b.com");
    expect(staffSignInLabel({ email: "", phone: "9841112222" })).toBe("984-111-2222");
    expect(staffSignInLabel({ email: "", phone: "" })).toBe("");
  });
});

/**
 * `toSafeStaff` lists every field by hand, and each one is optional, so an
 * omission type-checks silently. factoryWorkerId was dropped this way: the
 * Owner could link a worker, the link reached the database, and the portal
 * still reported the sign-in as unlinked.
 */
describe("toSafeStaff", () => {
  it("carries the identity and link fields the portal depends on", async () => {
    const source = await readFile("lib/admin-settings.ts", "utf8");
    const body = source.slice(source.indexOf("function toSafeStaff"));
    const mapping = body.slice(0, body.indexOf("\n}"));

    for (const field of ["email", "phone", "factoryWorkerId", "employeeId", "role", "status"]) {
      expect(mapping, field).toContain(`${field}: staff.${field}`);
    }
  });
});
