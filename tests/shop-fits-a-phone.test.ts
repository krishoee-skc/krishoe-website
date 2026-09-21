import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The shop does not spend a phone's screen on empty space.
 *
 * Every storefront section was written `py-14 md:py-20` — 112px of padding
 * above and below on a phone, raised to 160px on a desktop. The raise is
 * deliberate and right; the phone value was never lowered, so the small screen
 * carries the large screen's breathing room.
 *
 * Nine sections do this. That is 1008px of nothing on a 740px screen: more
 * than a full screen of scrolling before a customer has seen a single shoe,
 * and the owner noticed it from the screenshots alone.
 *
 * The rule below is the fix stated once: a section may breathe on a wide
 * screen, but its phone padding has to be the smaller of the two. Written as a
 * rule rather than a list so a section added next month cannot quietly bring
 * the old spacing back.
 */
const ROOTS = ["components", "app"];

/**
 * py-10 = 40px a side, the most a phone should spend on one section's edges.
 *
 * Not lower: a few sections already paired `py-10` with `md:py-20`, which is a
 * deliberate phone value someone chose — 40px reads as generous rather than
 * wasteful, and forcing those down would be this test dictating taste instead
 * of catching the fault it exists for. What it catches is a section carrying
 * the *desktop* value at phone width, which is py-12 and up.
 */
const PHONE_MAX = 10;

/** Every `py-N` that applies at phone width — i.e. carries no breakpoint. */
function phonePadding(className: string) {
  const out: number[] = [];
  for (const m of className.matchAll(/(?:^|\s)py-(\d+)/g)) out.push(Number(m[1]));
  return out;
}

function tallSections() {
  const found: { file: string; line: number; py: number }[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        // The admin is a working tool on a desk, not a shopfront on a phone.
        if (entry.name === "admin" || entry.name === "node_modules") continue;
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;

      const source = readFileSync(path, "utf8");
      for (const m of source.matchAll(/<section[^>]*className="([^"]*)"/g)) {
        for (const py of phonePadding(m[1])) {
          if (py <= PHONE_MAX) continue;
          found.push({
            file: path.split("\\").join("/"),
            line: source.slice(0, m.index).split(/\r?\n/).length,
            py,
          });
        }
      }
    }
  }

  for (const root of ROOTS) walk(root);
  return found;
}

describe("storefront sections on a phone", () => {
  it("never carry desktop padding at phone width", () => {
    const tall = tallSections();

    const report = tall
      .map((s) => `  ${s.file}:${s.line} — py-${s.py} (${s.py * 4}px a side)`)
      .join("\n");

    expect(
      tall,
      `these sections spend a phone's screen on empty space:\n${report}`,
    ).toEqual([]);
  });

  it("still allow a wider screen to breathe", () => {
    // The fix must not flatten the design everywhere: the desktop keeps its
    // generous spacing, which is what `md:py-*` is for. If every breakpoint
    // vanished, this would pass while the shop looked cramped on a laptop.
    const source = readFileSync("components/WhyChoose.tsx", "utf8");

    expect(source, "the desktop spacing was lost with the phone fix").toMatch(
      /\bmd:py-\d+/,
    );
  });

  it("finds sections at all, so the check cannot pass by reading nothing", () => {
    let sections = 0;
    function count(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "admin" || entry.name === "node_modules") continue;
          count(path);
        } else if (entry.name.endsWith(".tsx")) {
          sections += (readFileSync(path, "utf8").match(/<section/g) ?? []).length;
        }
      }
    }
    for (const root of ROOTS) count(root);

    expect(sections, "no sections found — the scan is broken").toBeGreaterThan(20);
  });
});

/**
 * And the bottom of the screen belongs to the tab bar.
 *
 * The chat button sits at `bottom-5 right-5` — 20px to 76px up from the
 * bottom edge, on the right. The tab bar occupies 10px to 78px across the full
 * width. They overlap, and what they overlap on is the last tab: "Account",
 * where a customer goes to find their own order. In all four of the owner's
 * screenshots it reads "Ac___nt".
 */
/**
 * Four short cards do not need four screens.
 *
 * "Why KRISHOE" is four promises of a line each, and each had a whole phone
 * screen to itself: one column, 32px of padding inside, 32px of gap between.
 * A customer scrolled through four screens of text to reach the shoes, and the
 * promises were never the reason they opened the shop.
 *
 * Two to a row on a phone puts all four in view at once. Nothing is removed —
 * the same words, read in one glance instead of four.
 */
describe("the why-choose cards", () => {
  it("sit two to a row on a phone", () => {
    const source = readFileSync("components/WhyChoose.tsx", "utf8");

    // Asserted as the phone-width column count, not merely the presence of a
    // grid: `md:grid-cols-2` alone leaves the phone at one column, which is
    // exactly the layout this replaces.
    const grid = source.match(/className="grid[^"]*"/)?.[0] ?? "";
    expect(grid, "the card grid moved").not.toBe("");
    expect(grid, "a phone must show two columns").toMatch(/(^|\s)grid-cols-2/);
  });

  it("keep four across on a wide screen", () => {
    const source = readFileSync("components/WhyChoose.tsx", "utf8");
    const grid = source.match(/className="grid[^"]*"/)?.[0] ?? "";

    // The desktop layout was already right and must survive the phone fix.
    expect(grid).toMatch(/lg:grid-cols-4/);
  });
});

describe("the chat button and the tab bar", () => {
  it("do not sit on top of each other", () => {
    const chat = readFileSync("components/AiAssistant.tsx", "utf8");

    // The tab bar's own top edge is about 78px up. The button has to clear it.
    // Asserted as a bottom offset large enough to do that, on the launcher
    // rather than the open panel.
    const launcher = chat.slice(chat.indexOf("fixed bottom-"), chat.indexOf("fixed bottom-") + 200);
    expect(launcher.length, "the chat launcher moved").toBeGreaterThan(0);

    const offset = launcher.match(/bottom-(\d+)/);
    expect(offset, "the chat button has no bottom offset").not.toBeNull();
    expect(
      Number(offset?.[1]) * 4,
      "the chat button still covers the last tab",
    ).toBeGreaterThanOrEqual(88);
  });
});
