import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The admin screens on the device the owner actually holds.
 *
 * Much of this was already right — tables reflow into cards below 767px,
 * controls sit at 16px so iOS does not zoom, and buttons are held to 44px. What
 * was not right was what the reflow could not reach.
 *
 * A table cell's contents were laid out to sit in a column, and several carry
 * their own minimum widths: 560px for the payment panel on the orders screen,
 * 360px for the form inside it, 260px for the item list. Stacking a cell into a
 * card does not clear a child's min-width, so on a 390px phone those pushed the
 * row sideways — and because the admin canvas clips rather than scrolls, the
 * payment controls were not pushed off screen so much as cut off it.
 */
const GLOBALS = "app/globals.css";

describe("the admin screens on a phone", () => {
  it("lets a reflowed card decide its own width", async () => {
    const css = await readFile(GLOBALS, "utf8");
    const phone = css.slice(css.indexOf("@media screen and (max-width: 767px)"));

    expect(phone).toContain(".reflow-table td > *");
    expect(phone).toContain("min-width: 0 !important");
  });

  it("still keeps controls at 16px, so iOS does not zoom the page", async () => {
    const css = await readFile(GLOBALS, "utf8");

    expect(css).toContain("font-size: 16px");
  });

  it("gives the thumb the day's work without opening a menu", async () => {
    const dock = await readFile("app/admin/AdminQuickDock.tsx", "utf8");

    // Read at a glance while standing on the factory floor, so Nepali.
    expect(dock).toContain("काम टिप्ने");
    expect(dock).toContain("बिल");
    expect(dock).toContain("canAccessAdminPath");
  });

  it("has the language switch on the bar that is on screen all day", async () => {
    // The switch moved from the phone bar into the shared layout's top row,
    // beside the search — still on screen all day, on the phone too.
    const layout = await readFile("app/admin/layout.tsx", "utf8");

    expect(layout).toContain("LanguageSwitch");
  });

  it("sizes the day's takings to fit a narrow screen before growing", async () => {
    const card = await readFile("components/admin/TodaySales.tsx", "utf8");

    // A 6xl figure set unconditionally wraps "रु. १,२३,४५६" onto two lines on a
    // 390px screen, which reads as two numbers.
    expect(card).toContain("text-[2.75rem]");
    expect(card).toContain("sm:text-6xl");
  });
});
