import { describe, expect, it } from "vitest";
import { shouldAllowAdminBootstrapLogin } from "@/lib/admin-bootstrap-login";

describe("admin bootstrap login retirement", () => {
  it("allows bootstrap only before an active Owner exists", () => {
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 0, explicitRecoveryOverride: false }),
    ).toBe(true);
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 2, explicitRecoveryOverride: false }),
    ).toBe(false);
  });

  it("supports an explicit emergency recovery override", () => {
    expect(
      shouldAllowAdminBootstrapLogin({ activeOwnerCount: 2, explicitRecoveryOverride: true }),
    ).toBe(true);
  });
});
