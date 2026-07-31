import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomerSessionToken,
  verifyCustomerSessionToken,
} from "@/lib/customer-session";

beforeEach(() => {
  vi.stubEnv("CUSTOMER_SESSION_SECRET", "test-customer-session-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("customer session tokens", () => {
  it("include an issued-at timestamp for stale-session checks", async () => {
    const issuedAfter = Date.now();
    const token = await createCustomerSessionToken({
      id: "user-1",
      email: "customer@example.com",
    });
    const session = await verifyCustomerSessionToken(token);

    expect(session?.sub).toBe("customer");
    expect(session?.userId).toBe("user-1");
    expect(session?.iat).toBeGreaterThanOrEqual(issuedAfter);
    expect(session?.iat).toBeLessThanOrEqual(Date.now());
  });

  it("rejects tokens when the customer session secret is missing", async () => {
    const token = await createCustomerSessionToken({
      id: "user-1",
      email: "customer@example.com",
    });

    vi.stubEnv("CUSTOMER_SESSION_SECRET", "");

    expect(await verifyCustomerSessionToken(token)).toBeNull();
  });
});
