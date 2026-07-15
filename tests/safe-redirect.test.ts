import { describe, expect, it } from "vitest";
import { safeAdminNextPath, safeCustomerNextPath } from "@/lib/safe-redirect";

// These guards prevent open-redirect attacks: a crafted `?next=` value must
// never send a user to another origin or into a privileged area.
describe("safeCustomerNextPath", () => {
  it("keeps a normal relative path", () => {
    expect(safeCustomerNextPath("/account/orders")).toBe("/account/orders");
  });

  it("preserves query and hash on a safe path", () => {
    expect(safeCustomerNextPath("/shop?category=heels#top")).toBe("/shop?category=heels#top");
  });

  it("rejects absolute URLs to another origin", () => {
    expect(safeCustomerNextPath("https://evil.example/steal")).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeCustomerNextPath("//evil.example")).toBe("/account");
  });

  it("rejects backslash tricks", () => {
    expect(safeCustomerNextPath("/\\evil.example")).toBe("/account");
  });

  it("rejects null/empty values with the fallback", () => {
    expect(safeCustomerNextPath(null)).toBe("/account");
    expect(safeCustomerNextPath(undefined)).toBe("/account");
    expect(safeCustomerNextPath("")).toBe("/account");
  });

  it("does not let customers redirect into admin or api areas", () => {
    expect(safeCustomerNextPath("/admin")).toBe("/account");
    expect(safeCustomerNextPath("/api/orders")).toBe("/account");
  });

  it("does not loop back to auth pages", () => {
    expect(safeCustomerNextPath("/account/login")).toBe("/account");
    expect(safeCustomerNextPath("/account/register")).toBe("/account");
    expect(safeCustomerNextPath("/account/reset-password")).toBe("/account");
  });
});

describe("safeAdminNextPath", () => {
  it("keeps a path inside the admin area", () => {
    expect(safeAdminNextPath("/admin/orders")).toBe("/admin/orders");
  });

  it("falls back for non-admin paths", () => {
    expect(safeAdminNextPath("/account")).toBe("/admin");
    expect(safeAdminNextPath("/shop")).toBe("/admin");
  });

  it("does not loop back to the admin login page", () => {
    expect(safeAdminNextPath("/admin/login")).toBe("/admin");
  });

  it("rejects cross-origin and protocol-relative URLs", () => {
    expect(safeAdminNextPath("https://evil.example/admin")).toBe("/admin");
    expect(safeAdminNextPath("//evil.example")).toBe("/admin");
  });
});
