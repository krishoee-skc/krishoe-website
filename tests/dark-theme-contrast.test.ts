import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Dark mode here is a remap layer in globals.css rather than a `dark:` utility
// beside each of eight hundred colour sites. That buys coverage but spends the
// compiler's help: nothing type-checks a hex against the surface it lands on,
// and "dark mode is done" is easy to say about a page nobody can read.
//
// So the numbers are checked instead. These are the WCAG AA thresholds — 4.5:1
// for body text, 3:1 for large text and UI edges — computed from the values the
// stylesheet actually declares, not from a copy of them kept here.

const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

function darkVariable(name: string) {
  const block = css.slice(css.indexOf(".dark {"));
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));

  if (!match) {
    throw new Error(`--${name} is not declared in the .dark block`);
  }

  return match[1];
}

function channel(value: number) {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );

  return (lighter + 0.05) / (darker + 0.05);
}

// Proven against the WCAG worked examples before being trusted below.
describe("the contrast maths itself", () => {
  it("scores black on white at 21:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("scores a colour against itself at 1:1", () => {
    expect(contrast("#13221d", "#13221d")).toBeCloseTo(1, 5);
  });
});

const surfaces = ["surface", "surface-sunken", "surface-raised"] as const;
const bodyInks = ["ink", "ink-body"] as const;

describe("dark theme text stays readable", () => {
  for (const surface of surfaces) {
    for (const ink of bodyInks) {
      it(`--${ink} on --${surface} clears 4.5:1`, () => {
        expect(contrast(darkVariable(ink), darkVariable(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }

    // Captions and labels — the class this app reaches for most (367 uses of
    // text-gray-500) — are still body text and get the full threshold.
    it(`--ink-muted on --${surface} clears 4.5:1`, () => {
      expect(contrast(darkVariable("ink-muted"), darkVariable(surface))).toBeGreaterThanOrEqual(4.5);
    });

    // --ink-faint is only ever placeholder and disabled text, which AA exempts,
    // but it still has to be visible.
    it(`--ink-faint on --${surface} clears 3:1`, () => {
      expect(contrast(darkVariable("ink-faint"), darkVariable(surface))).toBeGreaterThanOrEqual(3);
    });
  }

  it("keeps the page background and its text apart", () => {
    expect(contrast(darkVariable("foreground"), darkVariable("background"))).toBeGreaterThanOrEqual(4.5);
  });

  // The gold button label. Lifting it with the other .text-brand-green-ink uses
  // would have put near-white on bright gold; this is the rule that stops that,
  // checked rather than assumed.
  it("keeps the dark label on the gold button legible", () => {
    expect(css).toContain(".dark .bg-brand-gold-bright.text-brand-green-ink");
    expect(contrast("#10231d", "#D4AF37")).toBeGreaterThanOrEqual(4.5);
  });

  it("would have failed with the label lifted to --ink", () => {
    expect(contrast(darkVariable("ink"), "#D4AF37")).toBeLessThan(4.5);
  });
});

describe("the remap layer covers what the app actually paints with", () => {
  // Every neutral used more than ten times across app/ and components/. If a
  // new surface class becomes common and nobody adds a rule, this is what says
  // so — the failure mode otherwise is a white card in a dark page that only a
  // human looking at the right screen would catch.
  const mustBeRemapped = [
    ".bg-white",
    ".bg-gray-50",
    ".bg-gray-100",
    ".text-gray-900",
    ".text-gray-700",
    ".text-gray-600",
    ".text-gray-500",
    ".text-gray-400",
    ".border-gray-200",
    ".border-gray-100",
    ".border-black\\/10",
    ".bg-black\\/10",
    ".text-brand-green-ink",
    ".bg-brand-mist",
  ];

  for (const selector of mustBeRemapped) {
    it(`re-points ${selector.replace("\\", "")}`, () => {
      expect(css).toContain(`.dark ${selector}`);
    });
  }

  it("leaves the low-opacity whites alone", () => {
    // bg-white/10 and bg-white/20 are tints over dark green panels that already
    // carry white text. Darkening them would hide it.
    expect(css).not.toContain(".dark .bg-white\\/10");
    expect(css).not.toContain(".dark .bg-white\\/20");
  });
});

/**
 * The remap layer only covers what is listed in it.
 *
 * A phone set to dark mode gets the `dark` class before anyone chooses
 * anything — themeBootScript reads prefers-color-scheme. So an unlisted
 * background class is not "dark mode is incomplete", it is a white card on a
 * dark page, on a screen the owner did not ask to be dark.
 *
 * bg-brand-paper was exactly that: the paper every admin card, form and panel
 * is written on, used 534 times, and absent from the list. bg-brand-paper-deep
 * (125) and bg-brand-green-line (18 — a pale hairline colour used as a fill)
 * were the same.
 *
 * This counts what the app uses against what the stylesheet remaps, so the next
 * pale surface to be introduced is caught here rather than at night.
 */
describe("every pale surface the app paints has a dark answer", () => {
  const BACKSLASH = String.fromCharCode(92);
  const remapped = new Set(
    [...css.matchAll(new RegExp(`^\\.dark \\.([a-zA-Z0-9${BACKSLASH}${BACKSLASH}/-]+)`, "gm"))].map(
      (match) => match[1].split(BACKSLASH).join(""),
    ),
  );

  /**
   * Brand colours that keep their identity in the dark, on purpose.
   *
   * A shop is recognised by its colour: the solid green of a button, the gold
   * of a label, the clay of a warning. These carry white text already and
   * darkening them would make the app look like a different company. The pale
   * TINTS of those colours are remapped — they exist to sit behind dark text.
   */
  const KEEPS_ITS_COLOUR = [
    "bg-brand-green", "bg-brand-green-ink", "bg-brand-gold", "bg-brand-gold-bright",
    "bg-brand-clay", "bg-brand-clay-deep", "bg-brand-clay-ink", "bg-brand-danger",
    "border-brand-green", "border-brand-gold", "border-brand-gold-bright",
    "border-brand-clay", "border-brand-green-ink",
    // Deep browns and maroons that carry white text: the factory nav badge, the
    // report buttons, the gold labels. Darkening them would take the colour out
    // of the shop without making anything easier to read.
    "bg-brand-muted-deep", "bg-brand-maroon", "bg-brand-gold-deep", "bg-brand-gold-dark",
    // Text colours are handled by the ink tokens where they need to be; a brand
    // green heading stays brand green.
  ];

  it("remaps every pale background the app actually uses", async () => {
    const { readdirSync, statSync } = await import("node:fs");

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry)) files.push(full);
      }
    };
    walk(path.join(process.cwd(), "app"));
    walk(path.join(process.cwd(), "components"));

    const used = new Map<string, number>();
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(/\bbg-brand-[a-z-]+/g)) {
        used.set(match[0], (used.get(match[0]) ?? 0) + 1);
      }
    }

    const unanswered = [...used.entries()]
      .filter(([name]) => !remapped.has(name) && !KEEPS_ITS_COLOUR.includes(name))
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => `${name} (${count} places)`);

    expect(
      unanswered,
      "These backgrounds have no dark answer and no decision to keep their colour.\n" +
        "Either remap them in globals.css or add them to KEEPS_ITS_COLOUR with a reason:\n" +
        unanswered.join("\n"),
    ).toEqual([]);
  });

  it("remaps the paper the admin is written on", () => {
    // Named on their own because they are the ones that were missing, and the
    // ones whose absence turned dark mode into a half-lit screen.
    expect(remapped.has("bg-brand-paper")).toBe(true);
    expect(remapped.has("bg-brand-paper-deep")).toBe(true);
  });
});
