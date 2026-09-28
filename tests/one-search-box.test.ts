import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ADMIN_SEARCH_GROUPS, ADMIN_SEARCH_PAGES } from "@/lib/admin-search";

/**
 * One search box for the whole admin: the one at the top.
 *
 * The Search page had a big box of its own under the small one at the top of
 * every screen. The owner asked for one (2026-09-28). The same day's sample
 * also asked for: the pages in four parts instead of one list of twenty-six,
 * every menu page findable, results grouped by kind with the next step beside
 * them, and the last few searches remembered.
 */
describe("one box", () => {
  it("the Search page has no box of its own and opens the top one", async () => {
    const page = await readFile("app/admin/search/page.tsx", "utf8");
    expect(page).not.toContain("<SearchAsYouType");
    expect(page).not.toContain("<input");
    expect(page).toContain("<OpenSearchOnArrive query={query} />");
    const arrive = await readFile("app/admin/search/OpenSearchOnArrive.tsx", "utf8");
    expect(arrive).toContain("new CustomEvent(OPEN_SEARCH_EVENT");
    const bar = await readFile("app/admin/AdminCommandBar.tsx", "utf8");
    expect(bar).toContain("window.addEventListener(OPEN_SEARCH_EVENT, onOpenSearch)");
    expect(bar).toContain("<SearchAsYouType initialQuery={initialQuery} onNavigate={() => setOpen(false)} />");
  });
});

describe("the pages", () => {
  it("every page belongs to one of the four parts", () => {
    const ids = new Set(ADMIN_SEARCH_GROUPS.map((group) => group.id));
    for (const page of ADMIN_SEARCH_PAGES) {
      expect(page.group && ids.has(page.group), page.href).toBe(true);
    }
  });

  it("every page in the menu can be found", async () => {
    const menu = await readFile("app/admin/nav-links.ts", "utf8");
    const hrefs = [...menu.matchAll(/\{ href: "([^"]+)"/g)].map((match) => match[1]).filter((href) => href !== "/admin/search");
    const found = new Set(ADMIN_SEARCH_PAGES.map((page) => page.href));
    const missing = [...new Set(hrefs)].filter((href) => !found.has(href));
    expect(missing).toEqual([]);
  });
});

describe("the results", () => {
  it("come grouped by kind, with the next step, walked by the keyboard", async () => {
    const box = await readFile("app/admin/search/SearchAsYouType.tsx", "utf8");
    expect(box).toContain("const kinds = [...new Set(hits.map((hit) => hit.kind))];");
    expect(box).toContain('worker: [{ en: "Add work", ne: "काम टिप्ने", href: "/admin/factory/add-work" }]');
    expect(box).toContain('event.key === "ArrowDown"');
    expect(box).toContain('event.key === "Enter"');
  });

  it("remembers the last searches, and survives storage being blocked", async () => {
    const box = await readFile("app/admin/search/SearchAsYouType.tsx", "utf8");
    expect(box).toContain('const RECENT_KEY = "krishoe:recent-searches";');
    expect(box.slice(box.indexOf("function rememberSearch"), box.indexOf("function rememberSearch") + 600)).toContain("catch");
  });
});

describe("the clean box (2026-09-28)", () => {
  it("offers only Add work and Cut a bill before anything is typed", async () => {
    const box = await readFile("app/admin/search/SearchAsYouType.tsx", "utf8");
    const shortcuts = box.slice(box.indexOf("const SHORTCUTS = ["), box.indexOf("] as const;", box.indexOf("const SHORTCUTS = [")));
    expect([...shortcuts.matchAll(/href: "([^"]+)"/g)].map((match) => match[1])).toEqual([
      "/admin/factory/add-work",
      "/admin/pos",
    ]);
    // No page list in the empty box, and no request for one.
    expect(box).not.toContain("ADMIN_SEARCH_GROUPS");
    expect(box).toContain("An empty box asks for nothing");
  });

  it("the Search page lists nothing", async () => {
    const page = await readFile("app/admin/search/page.tsx", "utf8");
    expect(page).not.toContain("ADMIN_SEARCH_PAGES");
    expect(page).not.toContain("<Link");
  });

  it("a click on any Search link opens the box where the owner is", async () => {
    const bar = await readFile("app/admin/AdminCommandBar.tsx", "utf8");
    expect(bar).toContain('url.pathname !== "/admin/search"');
    expect(bar).toContain('document.addEventListener("click", onClick, true)');
    // Ctrl/middle click still opens the page.
    expect(bar).toContain("if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;");
  });
});
