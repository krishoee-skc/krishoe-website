import { readFile } from "node:fs/promises";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

/** Owner, 2026-10-13: "7, 8 and 11" from the second sample. */
describe("the admin's text size (7)", () => {
  it("has a normal / large / larger switch beside the language, remembered on the phone", async () => {
    const control = await read("components/admin/AdminTextSize.tsx");
    expect(control).toContain('const SIZES = ["100%", "112.5%", "125%"] as const;');
    expect(control).toContain('const KEY = "krishoe-admin-text";');
    expect(control).toContain('body.style.fontSize = "1rem";');
    const layout = await read("app/admin/layout.tsx");
    expect(layout.indexOf("<AdminTextSize />")).toBeGreaterThan(-1);
    expect(layout.indexOf("<AdminTextSize />")).toBeLessThan(layout.indexOf("<LanguageSwitch compact"));
  });

  it("has no admin text fixed in px, and none below 12px", () => {
    const offenders = [...filesUnder("app/admin"), ...filesUnder("components/admin")].filter((file) =>
      /text-\[[0-9.]+px\]/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("prints at the normal size, and a phone card's label is 12px", async () => {
    const css = await read("app/globals.css");
    expect(css).toContain("@media print {\n  /* Paper prints at the normal size");
    expect(css).toContain("html {\n    font-size: 100% !important;");
    expect(css).toContain("font-size: 0.75rem;");
  });
});

describe("44px controls on the five daily pages (8)", () => {
  it("leaves no 32–36px button or box in them, save a worker's initials", async () => {
    for (const file of [
      "app/admin/pos/_components/PosBillForm.tsx",
      "app/admin/factory/add-work/WorkEntryForm.tsx",
      "app/admin/factory/photos/WorkerInbox.tsx",
      "app/admin/stock/WherePairsAre.tsx",
      "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx",
    ]) {
      const small = (await read(file))
        .split("\n")
        .filter((line) => /\b(min-)?h-(8|9)\b/.test(line))
        // The round initials and the pairs badge inside a bigger button are not things to press.
        .filter((line) => !/rounded-full bg-brand-(green|gold-deep) text-xs/.test(line) && !line.includes("border-[1.5px] border-brand-green"));
      expect(small, file).toEqual([]);
    }
  });
});

describe("setting a place's count needs a write permission (11)", () => {
  it("asks operations:write, the same as 🔢 Count, and hides the buttons from the rest", async () => {
    const actions = await read("app/admin/stock/actions.ts");
    const action = actions.slice(actions.indexOf("export async function setPlaceCountAction"));
    expect(action.slice(0, 600)).toContain('await requireAdminPermission("operations:write");');
    const screen = await read("app/admin/stock/WherePairsAre.tsx");
    expect(screen).toContain("{canCount ? (\n      <div ref={countBox}>");
    expect(screen).toContain("{canCount ? (\n                  <div className=\"flex flex-wrap gap-2\">");
  });
});
