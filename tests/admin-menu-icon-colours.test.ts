import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminNavGroups, adminNavTone, adminNavToneClasses } from "@/app/admin/nav-links";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The owner chose "B" (2026-09-29): one colour per menu group, on a soft tile,
 * filled for the open page — every icon had been the same dark green. And no
 * icon twice: wages and costing both showed the coins.
 */
describe("menu icon colours", () => {
  it("gives each group its colour: work green, cost gold, customers purple, everywhere blue", () => {
    expect(adminNavTone("factory-work")).toBe("green");
    expect(adminNavTone("factory-cost")).toBe("gold");
    expect(adminNavTone("shop-sell")).toBe("green");
    expect(adminNavTone("shop-customers")).toBe("purple");
    expect(adminNavTone("shop-money")).toBe("gold");
    expect(adminNavTone("everywhere")).toBe("blue");
    expect(adminNavTone("something-new")).toBe("blue");
  });

  it("has a soft tile and a filled tile for every colour, dark mode included", () => {
    for (const tone of Object.values(adminNavToneClasses)) {
      expect(tone.tile).toMatch(/dark:/);
      expect(tone.active).toContain("text-white");
      expect(tone.active).toMatch(/dark:/);
    }
  });

  it("draws the tile in the sidebar and the phone menu, filled for the open page", async () => {
    for (const file of ["app/admin/AdminNav.tsx", "app/admin/AdminMobileNav.tsx"]) {
      const source = await read(file);
      expect(source, file).toContain("adminNavToneClasses[adminNavTone(group.id)]");
    }
  });
});

describe("menu icons", () => {
  it("never repeats one icon inside a group, or across the factory menu", () => {
    const factory = adminNavGroups.filter((group) => group.workspace !== "shop");
    const hrefsByIcon = new Map<unknown, Set<string>>();
    for (const group of factory) {
      for (const link of group.links) {
        const set = hrefsByIcon.get(link.icon) ?? new Set<string>();
        set.add(link.href);
        hrefsByIcon.set(link.icon, set);
      }
    }
    for (const [, hrefs] of hrefsByIcon) {
      // The same page listed in two groups (stock) may share its icon.
      expect(hrefs.size, [...hrefs].join(", ")).toBe(1);
    }
  });

  it("uses a calculator for costing, a chart for reports and a gear for settings", async () => {
    const links = await read("app/admin/nav-links.ts");
    expect(links).toContain('label: "Costing", nepali: "लागत", icon: CalculatorIcon');
    expect(links).toContain('label: "Report", nepali: "हिसाब", icon: BarChartIcon');
    expect(links).toContain('label: "Settings", nepali: "सेटिङ · सेटअप", icon: GearIcon');
  });
});
