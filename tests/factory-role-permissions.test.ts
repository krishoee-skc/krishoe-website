import { describe, expect, it } from "vitest";
import { canAdmin } from "@/lib/admin-role-permissions";

describe("Factory watcher permissions", () => {
  it("allows factory entry without exposing financial or stock mutations", () => {
    expect(canAdmin("Factory", "production:entry")).toBe(true);
    expect(canAdmin("Factory", "operations:write")).toBe(false);
    expect(canAdmin("Factory", "costing:write")).toBe(false);
    expect(canAdmin("Factory", "pos:write")).toBe(false);
    expect(canAdmin("Factory", "purchasing:write")).toBe(false);
    expect(canAdmin("Factory", "settings:write")).toBe(false);
  });
});
