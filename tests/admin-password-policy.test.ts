import { describe, expect, it } from "vitest";
import {
  adminPasswordPolicyMessage,
  adminPasswordStrength,
} from "@/lib/admin-password-policy";

describe("admin staff password policy", () => {
  it("rejects short and repetitive passwords", () => {
    expect(adminPasswordPolicyMessage("short1")).toMatch(/12/);
    expect(adminPasswordPolicyMessage("aaaaaaaaaaaa1")).toBeTruthy();
  });

  it("accepts a long mixed password and scores it strongly", () => {
    const password = "Krishoe-Team-2026-Safe";
    expect(adminPasswordPolicyMessage(password)).toBe("");
    expect(adminPasswordStrength(password).score).toBeGreaterThanOrEqual(3);
  });
});
