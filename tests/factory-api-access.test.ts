import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSession = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  getAdminSession: (...args: unknown[]) => getAdminSession(...args),
}));

const {
  authorizeFactoryApi,
  canAccessFactoryApi,
  getFactoryApiPolicy,
} = await import("@/lib/factory-api-access");

beforeEach(() => {
  getAdminSession.mockReset();
});

describe("Factory API access policy", () => {
  it("returns 401 when no valid admin session reaches the route handler", async () => {
    getAdminSession.mockResolvedValue(null);

    const response = await authorizeFactoryApi("/api/factory/work", "POST");

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("lets the Factory role enter work but not change financial rates", () => {
    const workPolicy = getFactoryApiPolicy("/api/factory/work", "POST");
    const ratePolicy = getFactoryApiPolicy("/api/factory/rates", "POST");

    expect(workPolicy && canAccessFactoryApi("Factory", workPolicy)).toBe(true);
    expect(ratePolicy && canAccessFactoryApi("Factory", ratePolicy)).toBe(false);
  });

  it("allows HR to read salary data but keeps cash mutations Owner-only", () => {
    const salaryPolicy = getFactoryApiPolicy("/api/factory/salary", "GET");
    const paymentPolicy = getFactoryApiPolicy("/api/factory/salary-payment", "POST");

    expect(salaryPolicy && canAccessFactoryApi("HR", salaryPolicy)).toBe(true);
    expect(paymentPolicy && canAccessFactoryApi("HR", paymentPolicy)).toBe(false);
    expect(paymentPolicy && canAccessFactoryApi("Owner", paymentPolicy)).toBe(true);
  });

  it("keeps Factory-to-HR identity linkage Owner-only", () => {
    const linkPolicy = getFactoryApiPolicy("/api/factory/workers", "PATCH");

    expect(linkPolicy && canAccessFactoryApi("HR", linkPolicy)).toBe(false);
    expect(linkPolicy && canAccessFactoryApi("Factory", linkPolicy)).toBe(false);
    expect(linkPolicy && canAccessFactoryApi("Owner", linkPolicy)).toBe(true);
  });

  it("keeps Factory-to-Production Item linkage Owner-only", () => {
    const linkPolicy = getFactoryApiPolicy("/api/factory/items", "PATCH");

    expect(linkPolicy && canAccessFactoryApi("Factory", linkPolicy)).toBe(false);
    expect(linkPolicy && canAccessFactoryApi("Inventory", linkPolicy)).toBe(false);
    expect(linkPolicy && canAccessFactoryApi("Owner", linkPolicy)).toBe(true);
  });

  it("fails closed for an unregistered Factory route or method", async () => {
    getAdminSession.mockResolvedValue({ role: "Owner" });

    const response = await authorizeFactoryApi("/api/factory/new-financial-route", "POST");

    expect(response?.status).toBe(403);
  });

  it("accepts a valid authorized session at the route-handler layer", async () => {
    getAdminSession.mockResolvedValue({ role: "Factory" });

    await expect(authorizeFactoryApi("/api/factory/work", "POST")).resolves.toBeNull();
  });
});
