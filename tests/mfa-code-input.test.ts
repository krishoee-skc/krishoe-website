import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The owner reached the two-step screen on an iPhone and found
 * "Krisha@rijal66" — their saved password — sitting in the code box, put there
 * by the phone's password manager on the screen right after a password field.
 *
 * The input already asked for a numeric keypad, declared itself a one-time code
 * and capped its length. Autofill does not go through the keyboard, so it
 * arrived anyway. Left alone the value would either sit there looking like an
 * answer or silently reduce to "66", and the form would only say the code was
 * wrong — which is what happened, and why the owner could not tell whether they
 * had used the app wrong or the app was broken.
 */
describe("the two-step code box", () => {
  it("keeps the platform hints and takes only digits", async () => {
    const source = await readFile("components/AdminLoginForm.tsx", "utf8");

    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('autoComplete="one-time-code"');
    // The controlled value is what actually holds the line; the attributes are
    // a request, and iOS declined it.
    expect(source).toContain("function acceptCode");
    expect(source).toContain('raw.replace(/\\D+/g, "").slice(0, 6)');
    expect(source).toContain("value={code}");
  });

  it("says what happened instead of only saying the code is wrong", async () => {
    const source = await readFile("components/AdminLoginForm.tsx", "utf8");

    expect(source).toContain("codeWasFilled");
    expect(source).toContain("त्यो password जस्तो देखियो");
    expect(source).toContain("Gmail खोलेर कोड हेर्नुहोस्");
  });
});
