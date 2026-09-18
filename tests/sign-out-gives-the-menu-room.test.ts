import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Sign out should not take a menu row's worth of space away from the menu.
 *
 * It sat in its own block at the foot of the sidebar — a full-width bordered
 * button with padding above and below — costing roughly sixty pixels that the
 * navigation above it could have used. On a laptop that is one more menu row
 * visible without scrolling, and the admin menu is long enough that the owner
 * scrolls it daily.
 *
 * It is also the wrong weight for what it is. A bordered, full-width control
 * reads as a primary action, and signing out is the one thing on this screen
 * nobody comes here to do. The destructive-looking red button that shouts for
 * attention is the one that should ask for the least.
 *
 * So it keeps its place at the foot — that is where people expect it, and
 * flex-1 on the nav above already pins it there — but stops being a slab: a
 * quiet inline row, at the muted weight of a caption, turning red only on
 * hover.
 */
const NAV = "app/admin/AdminNav.tsx";

describe("the sign-out row", () => {
  it("stays at the foot of the sidebar", async () => {
    const nav = await readFile(NAV, "utf8");

    // flex-1 on the scrolling nav is what pushes this down; without it the
    // button would float up under the last menu item.
    expect(nav).toContain("flex-1 overflow-auto");
    expect(nav.lastIndexOf("Sign out")).toBeGreaterThan(nav.indexOf("flex-1 overflow-auto"));
  });

  it("no longer reads as a primary button", async () => {
    const nav = await readFile(NAV, "utf8");
    const block = nav.slice(nav.indexOf("action={logoutAdminAction}"), nav.indexOf("action={logoutAdminAction}") + 900);

    expect(block.length, "the sign-out block moved").toBeGreaterThan(0);
    // A border plus a paper fill is what made it a slab. Quiet means neither.
    expect(block, "no boxed button").not.toMatch(/border border-admin-border/);
    expect(block, "no filled background").not.toContain("bg-brand-paper");
  });

  it("is quiet until it is pointed at", async () => {
    const nav = await readFile(NAV, "utf8");
    const block = nav.slice(nav.indexOf("action={logoutAdminAction}"), nav.indexOf("action={logoutAdminAction}") + 900);

    // Muted at rest, red on hover: present without competing with the menu.
    expect(block).toMatch(/text-brand-muted/);
    expect(block).toMatch(/hover:text-red/);
  });

  it("keeps a tappable height on a phone", async () => {
    const nav = await readFile(NAV, "utf8");
    const block = nav.slice(nav.indexOf("action={logoutAdminAction}"), nav.indexOf("action={logoutAdminAction}") + 900);

    // Smaller must not mean harder to hit. Losing the slab is worth nothing if
    // the owner then misses the row on a phone.
    expect(block).toMatch(/min-h-(10|11|12)/);
  });
});
