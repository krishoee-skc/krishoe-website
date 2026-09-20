import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No pale card is left glowing when the admin goes dark.
 *
 * Dark mode here is not written as `dark:` on every element. The brand's own
 * colours are remapped once in globals.css — `.dark .bg-brand-paper` and fifty
 * eight siblings — so three thousand usages change from one place. That is the
 * better design, and it already covers every token the screens paint with.
 *
 * It has one blind spot, and it is structural rather than an oversight: a fill
 * written as a literal hex, `bg-[#ECFDF5]`, is not a token, so no remap can
 * reach it. Two of those were found and handled when this was last looked at —
 * the file says so — but seven more have appeared since, all pale, all on
 * screens the owner opens: the activity feed and the reports page.
 *
 * At night each of them is a bright card on a dark page, with the lifted
 * near-white ink still drawn inside it: pale text on a pale fill, which is the
 * one combination that cannot be read at all.
 *
 * This test holds the rule rather than the seven: any literal fill used in the
 * admin must have a dark counterpart. A new one added next month fails here
 * instead of being found at night by the owner.
 */
const CSS = "app/globals.css";
const ADMIN = ["app/admin", "components/admin"];

/** Every `bg-[#RRGGBB]` written in the admin. */
async function literalFills(): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>();

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;

      const code = await readFile(path, "utf8");
      for (const match of code.matchAll(/bg-\[#([0-9A-Fa-f]{6})\]/g)) {
        const hex = match[1].toUpperCase();
        found.set(hex, [...(found.get(hex) ?? []), path]);
      }
    }
  }

  for (const dir of ADMIN) await walk(dir);
  return found;
}

/**
 * How light a colour is, 0 (black) to 1 (white).
 *
 * Only the pale ones matter. A fill that is already dark — the deep green used
 * for a header band — reads correctly at night as it is, and demanding a dark
 * counterpart for it would be a rule that asks for nothing.
 */
function lightness(hex: string) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

describe("literal fills in the admin", () => {
  it("each pale one has a dark counterpart", async () => {
    const css = await readFile(CSS, "utf8");
    const fills = await literalFills();

    const glowing: string[] = [];
    for (const [hex, files] of fills) {
      if (lightness(hex) < 0.75) continue;

      // The escaped form Tailwind emits: .dark .bg-\[\#ECFDF5\]
      const covered = css.includes(`.bg-\\[\\#${hex}\\]`) || css.includes(`.bg-\\[\\#${hex.toLowerCase()}\\]`);
      if (!covered) glowing.push(`#${hex} (${files[0]})`);
    }

    expect(
      glowing,
      `these pale fills stay bright in dark mode:\n  ${glowing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("finds the fills at all, so the check cannot pass by reading nothing", async () => {
    // The guard on the guard: if the walk stopped finding files, every fill
    // would be "covered" and this suite would go quietly green on a real
    // regression.
    const fills = await literalFills();
    expect(fills.size, "no literal fills found — the scan is broken").toBeGreaterThan(0);
  });
});
