import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The owner asked for two things on the sign-in card, 2026-09-28: a way to see
 * what was typed into the password box, and a warning when Caps Lock is on.
 */
describe("the password box", () => {
  it("has an eye that shows and hides what was typed", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    expect(form).toContain('type={showPassword ? "text" : "password"}');
    expect(form).toContain("aria-pressed={showPassword}");
    expect(form).toContain('text("Show password", "Password देखाउनुहोस्")');
    // The browser still knows it is the saved password.
    expect(form).toContain('autoComplete="current-password"');
  });

  it("warns when Caps Lock is on", async () => {
    const form = await readFile("components/AdminLoginForm.tsx", "utf8");
    expect(form).toContain('event.getModifierState("CapsLock")');
    expect(form).toContain("Caps Lock अन छ");
  });
});
