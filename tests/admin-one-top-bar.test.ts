import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getAdminBell } from "@/lib/admin-bell";
import { shortcutForPath } from "@/app/admin/admin-shortcuts";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The menu sample (owner, 2026-10-14): "क. सबै" without ＋ नयाँ — one top bar,
 * 🔔, ★ favourites, the phone menu from the bottom, a five-button dock, the
 * account behind the round initials, a full or narrow menu and light or dark,
 * and the menu's own words in Nepali.
 */
describe("one top bar", () => {
  it("is 64px on a phone and 72px on a computer, sticky only on a phone", async () => {
    const layout = await read("app/admin/layout.tsx");
    expect(layout).toContain('<header data-admin-chrome className="sticky top-0 z-40');
    // Scrolls away on a computer, still above the page (2026-10-21: static
    // let the red notice cover the 🔔 list).
    expect(layout).toContain("lg:relative lg:bg-brand-paper");
    expect(layout).not.toContain("lg:static");
    expect(layout).toContain('className="relative flex h-16 items-center gap-2 px-3 sm:px-4 lg:h-[4.5rem]');
  });

  it("carries the page's name, the search, the bell, and the look", async () => {
    const layout = await read("app/admin/layout.tsx");
    const header = layout.slice(layout.indexOf("<header"), layout.indexOf("</header>"));
    for (const piece of ["<WorkspaceBand />", "<AdminCommandBar />", "<AdminBell items={bell} />", "<AdminTextSize single />", "<LanguageSwitch single />", "<ThemeToggle className=", "<AdminProfileButton identity={identity} />"]) {
      expect(header, piece).toContain(piece);
    }
    expect(layout).toContain("<AdminTextSizeApplier />");
    expect(layout).not.toContain("KRISHOE Admin");
  });

  it("draws the side as a 3px line and the page's name large, with a ☆ to pin it", async () => {
    const band = await read("app/admin/WorkspaceBand.tsx");
    expect(band).toContain("absolute inset-x-0 top-0 h-[3px]");
    expect(band).toContain('{ factory: "bg-brand-green", shop: "bg-brand-maroon", both: "bg-brand-gold" }');
    // A screen of both sides names no side (owner, 2026-10-29): "KRISHOE › Settings",
    // not the side seen last — the simple menu has no side switch.
    expect(band).toContain('const workspace = side === "both" ? undefined : adminWorkspaces.find((option) => option.id === side);');
    expect(band).toContain("text-[1.1875rem] font-black");
    expect(band).toContain("lg:text-2xl");
    expect(band).toContain("togglePin(section.href)");
    expect(band).toContain("rememberVisit(pathname)");
  });

  it("is a 🔍 on a phone and the whole box from a tablet up", async () => {
    const bar = await read("app/admin/AdminCommandBar.tsx");
    expect(bar).toContain("h-11 w-11 shrink-0");
    expect(bar).toContain("md:w-full");
    expect(bar).toContain('className="hidden flex-1 truncate text-sm font-semibold md:inline"');
    expect(bar).toContain('text("Search or ask…", "खोज्नुहोस् वा सोध्नुहोस्…")');
    expect(bar).toContain(">Ctrl K</span>");
  });
});

describe("the 🔔", () => {
  it("lists only what this role may open", async () => {
    const items = await getAdminBell({
      role: "Factory",
      inbox: { photos: 2, requests: 1 },
      checks: [
        { id: "x", severity: "critical", title: "Products", titleNe: "सामान", detail: "d", detailNe: "द", href: "/admin/products" },
      ],
    });
    // Factory may open workers' photos, not orders, products or the inbox.
    expect(items.map((item) => item.id)).toEqual(["worker-photos", "worker-requests"]);
    expect(items[0].href).toBe("/admin/factory/photos");
  });

  it("puts the worst first, and counts the orders not billed yet", async () => {
    const bell = await read("lib/admin-bell.ts");
    expect(bell).toContain("WHERE status IN ('New', 'Contacted')");
    expect(bell).toContain('canAdmin(role, "feedback:read")');
    expect(bell).toContain("order[left.tone] - order[right.tone]");
  });
});

describe("★ favourites and the pages opened lately", () => {
  it("names a screen by its menu entry, setup screens included", () => {
    expect(shortcutForPath("/admin/factory/add-work")?.href).toBe("/admin/factory");
    expect(shortcutForPath("/admin/activity")?.href).toBe("/admin/activity");
    expect(shortcutForPath("/admin/pos/INV-1")?.href).toBe("/admin/pos");
  });

  it("are kept on the device, and only ever menu destinations", async () => {
    const store = await read("app/admin/admin-shortcuts.ts");
    expect(store).toContain('const PINS_KEY = "krishoe-admin-pins";');
    expect(store).toContain('const RECENT_KEY = "krishoe-admin-recent";');
    expect(store).toContain("Boolean(shortcutLink(href))");
    const nav = await read("app/admin/AdminNav.tsx");
    expect(nav).toContain("pinnedLinks.map");
    expect(nav).toContain("canAccessAdminPath(adminRole, href)");
    expect(nav).toContain("border-dashed border-brand-gold/50 bg-brand-gold-wash");
  });
});

describe("the phone menu", () => {
  it("rises from the bottom, with search, favourites and lately opened first", async () => {
    const sheet = await read("app/admin/AdminMobileNav.tsx");
    expect(sheet).toContain("absolute inset-x-0 bottom-0");
    expect(sheet).toContain("new CustomEvent(OPEN_SEARCH_EVENT");
    expect(sheet).toContain("usePins()");
    expect(sheet).toContain("useRecent()");
    expect(sheet).toContain("grid grid-cols-3 gap-1.5");
    expect(sheet).toContain("mt-4 grid grid-cols-4 gap-1.5");
    expect(sheet).toContain('text("☆ Add", "☆ थप्ने")');
    expect(sheet).not.toContain("XIcon");
    expect(sheet.indexOf("usePins()")).toBeLessThan(sheet.indexOf("hubsFor(adminRole).map("));
  });

  it("leaves the dock five buttons, search being the bar's 🔍", async () => {
    const dock = await read("app/admin/AdminQuickDock.tsx");
    expect(dock).not.toContain("/admin/search");
  });
});

describe("you, behind the round initials", () => {
  it("holds the identity, the text size, the language, light or dark, the menu's width, and Sign out", async () => {
    const account = await read("app/admin/AdminAccount.tsx");
    for (const piece of ["<AdminIdentityCard {...identity} />", "<AdminTextSize />", "<LanguageSwitch compact />", "<ThemeToggle />", "toggleSidebar()"]) {
      expect(account, piece).toContain(piece);
    }
    const nav = await read("app/admin/AdminNav.tsx");
    expect(nav).not.toContain("import AdminIdentityCard");
    expect(nav).toContain("<AdminAccountPanel identity={identity} showMenuStyle={!onTablet}>");
    expect(nav).toContain('{text("Sign out", "बाहिर निस्कने")}');
  });

  it("keeps one text size, set from one place", async () => {
    const size = await read("components/admin/AdminTextSize.tsx");
    expect(size).toContain("export function AdminTextSizeApplier()");
    expect(size).toContain("useSyncExternalStore(subscribe, currentStep, () => 0)");
  });
});
