import { describe, expect, it } from "vitest";
import { shouldOfferReload } from "@/lib/version-check";

// The owner kept working on a tab opened before a fix shipped. This is the
// decision that now catches that — and it must never misfire into a reload
// loop, so anything uncertain resolves to "do not prompt".
describe("offering a reload when a newer version is live", () => {
  it("offers a reload when the deployment has changed", () => {
    expect(shouldOfferReload("abc123", "def456")).toBe(true);
  });

  it("stays quiet when the deployment is unchanged", () => {
    expect(shouldOfferReload("abc123", "abc123")).toBe(false);
  });

  // The reload-loop guards: an unknown version on either side prompts nothing.
  it("stays quiet when either side is empty", () => {
    expect(shouldOfferReload("", "def456")).toBe(false);
    expect(shouldOfferReload("abc123", "")).toBe(false);
    expect(shouldOfferReload("", "")).toBe(false);
  });

  it("stays quiet on a missing or malformed answer", () => {
    expect(shouldOfferReload("abc123", undefined)).toBe(false);
    expect(shouldOfferReload("abc123", null)).toBe(false);
    expect(shouldOfferReload("abc123", 404)).toBe(false);
    expect(shouldOfferReload(undefined, "def456")).toBe(false);
  });
});
