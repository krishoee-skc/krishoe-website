import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The owner's sample, part 6 (2026-10-12): search, report and settings. The
 * search box already showed recent searches and shortcuts when empty, so the
 * search page is left as it is.
 */
describe("Report", () => {
  it("is tabs on a phone and all open on a computer, rupees behind one eye", async () => {
    const page = await read("app/admin/reports/page.tsx");
    expect(page).toContain('id="reports"');
    expect(page).toContain("openOnWide");
    expect(page).toContain('{card.valueKind === "money" ? <Amount>{shown}</Amount> : shown}');
    expect(page).toContain("<AmountsToggle />");
    const kit = await read("components/admin/PageKit.tsx");
    expect(kit).toContain("export function Amount(");
    expect(kit).toContain("useSyncExternalStore(subscribeAmounts, () => amountsShown, () => false)");
  });
});

describe("Settings", () => {
  it("shows only what is left to fill, the filled ones folded, the robot below", async () => {
    const sections = await read("app/admin/settings/SettingsSections.tsx");
    expect(sections).toContain("{todos.filter((todo) => !todo.done).map((todo) => (");
    expect(sections).toContain('text(`✓ ${done} filled`, `✓ ${done} भरियो`)');
    const page = await read("app/admin/settings/page.tsx");
    expect(page.indexOf("<SettingsSections")).toBeLessThan(page.indexOf('id="photo-robot"'));
  });
});

describe("Search", () => {
  it("already shows recent searches and shortcuts when the box is empty", async () => {
    const box = await read("app/admin/search/SearchAsYouType.tsx");
    expect(box).toContain("setRecent(readRecent())");
    expect(box).toContain("it shows the shortcuts, not a list");
  });
});
