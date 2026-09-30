import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The Owner's four figures — sales less purchases, stock at selling price,
 * customers owe, owed to workers — start hidden on every visit and show on the
 * eye (owner, 2026-10-01, choice (क): these four only; today's sales stay).
 */
describe("the Owner's four figures", () => {
  it("start hidden, in memory only, and open one by one or all together", async () => {
    const board = (await readFile("components/admin/OwnerDashboard.tsx", "utf8")).replace(/\r\n/g, "\n");
    expect(board).toContain("const [openFigures, setOpenFigures] = useState<Set<string>>(() => new Set());");
    expect(board).toContain('data-figures-eye="all"');
    expect(board).toContain("data-figures-eye={tile.href}");
    expect(board).toContain("data-figure-hidden");
    expect(board).not.toMatch(/openFigures[\s\S]{0,200}localStorage/);
  });

  it("are not told in the news strip either", async () => {
    const board = await readFile("components/admin/OwnerDashboard.tsx", "utf8");
    expect(board).not.toContain("This month, sales less purchases");
  });
});
