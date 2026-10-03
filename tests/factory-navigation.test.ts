import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Factory admin navigation", () => {
  it("uses the Admin shell and a compact horizontal Factory sub-navigation", () => {
    const layout = readFileSync(resolve("app/admin/factory/layout.tsx"), "utf8");
    const navigation = readFileSync(
      resolve("app/admin/factory/_components/factory-nav.tsx"),
      "utf8",
    );

    // with how many workers' photos wait (2026-10-03)
    expect(layout).toContain("<FactoryNav waiting={inbox.photos + inbox.requests} />");
    expect(layout).not.toContain("lg:w-56");
    expect(navigation).toContain('aria-label="Factory sections"');
    expect(navigation).toContain("overflow-x-auto");
    expect(navigation).toContain('href: "/admin/factory/salary"');
  });
});
