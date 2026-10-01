import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The computer's menu stays on screen (owner, 2026-10-01): it scrolled away
 * with a long page and left a blank strip under Sign out.
 */
describe("the admin sidebar", () => {
  it("is sticky and the screen's full height, with the names scrolling inside", async () => {
    const nav = (await readFile("app/admin/AdminNav.tsx", "utf8")).replace(/\r\n/g, "\n");
    expect(nav).toContain("md:sticky md:top-0 md:h-dvh md:self-start md:block md:w-20");
    expect(nav).toContain('<div className="flex h-full flex-col gap-0">');
    expect(nav).toContain("flex-1 overflow-auto");
    expect(nav).toContain("pointer-events-none sticky -bottom-2.5");
  });
});
