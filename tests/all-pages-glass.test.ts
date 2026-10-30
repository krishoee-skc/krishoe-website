import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ALL_PAGE_GROUPS } from "@/app/admin/hubs";
import { GROUP_COLOURS, hasAllPagesIcon } from "@/app/admin/hub/all-pages-icons";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * All pages in the glass namuna (owner, 2026-10-30, "cha garau"): 55 rows of
 * one pale icon became panes of coloured tiles. Every page keeps its own
 * drawing and every group its colour, so a page added later cannot quietly
 * fall back to a blank tile.
 */
describe("All pages, glass", () => {
  it("draws every page on the screen and colours every group", () => {
    for (const group of ALL_PAGE_GROUPS) {
      expect(GROUP_COLOURS[group.en], group.en).toMatch(/^#[0-9A-F]{6}$/i);
      for (const href of group.pages) expect(hasAllPagesIcon(href), href).toBe(true);
    }
  });

  it("draws no page the same as another", async () => {
    const source = await read("app/admin/hub/all-pages-icons.tsx");
    const drawings = [...source.matchAll(/^ {2}"\/admin[^"]*": (<>.*<\/>),$/gm)].map((match) => match[1]);
    expect(drawings.length).toBe(ALL_PAGE_GROUPS.reduce((total, group) => total + group.pages.length, 0));
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it("keeps the search, the waiting counts and the four big buttons from ★ favourites", async () => {
    const screen = await read("app/admin/hub/HubScreen.tsx");
    expect(screen).toContain('placeholder={text("Find a page", "page खोज्नुहोस्")}');
    expect(screen).toContain("const words = count > 0 ? waitWords(href, count) : null;");
    expect(screen).toContain("[...new Set([...pins, ...USUAL_FOUR])]");
    expect(screen).toContain("motion-reduce:transition-none");
  });
});
