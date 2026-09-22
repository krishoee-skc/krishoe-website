import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compactSizeRun } from "@/lib/shoe-sizes";
import { waitingCounts } from "@/app/admin/factory/add-work/WorkEntryForm";

/**
 * The size belongs on the option, and it has to fit.
 *
 * The dropdown names the shoe, the pairs waiting and the colour. It does not
 * say the size, and the owner's own entry is what that costs: bachha sandil's
 * uppers were recorded as 31–35 when they were made 25–30, and nothing on the
 * screen where the bottom work is chosen could have shown it. Sixty pairs sat
 * unpostable until the size was corrected by hand.
 *
 * Spelled out, the size does not fit. A phone dropdown holds roughly 32 to 38
 * characters at 360px, and "bachha sandil — 60 Black · 25, 26, 27, 28, 29, 30
 * waiting" is 57: the option wraps to two lines and the list stops being
 * scannable, which is the thing the option list is for.
 *
 * Compacting the run is what pays for it. "25, 26, 27, 28, 29, 30" becomes
 * "25-30", 17 characters back, and the word "waiting" gives up its place to the
 * size — so the label carries the size at the same length it is today.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";
const RULES = "app/admin/factory/add-work/work-entry-rules.ts";

// The screen is two files: the form that draws the boxes, and the rules it
// follows. What the option shows is decided in the rules, so these read the
// pair as one screen.
async function screen() {
  const [form, rules] = await Promise.all([readFile(FORM, "utf8"), readFile(RULES, "utf8")]);
  return form + "\n" + rules;
}

/** What a phone dropdown shows before it wraps, at 360px. */
const PHONE_LABEL_LIMIT = 38;

describe("the label fits a phone", () => {
  it("stays on one line for every shoe in the factory", () => {
    // The real runs, as they are stored today: the two spellings of 36–41 and
    // the children's run, with the longest item names this shop has.
    const shoes = [
      { name: "bachha sandil", pairs: 60, colour: "Black", size: "25, 26, 27, 28, 29, 30" },
      { name: "backopen jali", pairs: 60, colour: "White", size: "36, 37, 38, 39, 40, 41" },
      { name: "bagopen cherry", pairs: 60, colour: "cherry", size: "36/41" },
      { name: "fom close shoes", pairs: 60, colour: "black", size: "36/41" },
    ];

    for (const shoe of shoes) {
      const label = `${shoe.name} — ${shoe.pairs} ${shoe.colour} · ${compactSizeRun(shoe.size)}`;
      expect(label.length, `${label} is too long for a phone`).toBeLessThanOrEqual(
        PHONE_LABEL_LIMIT,
      );
    }
  });

  it("is what the spelled-out size would have cost", () => {
    // The measurement the decision rests on, kept here so it cannot quietly
    // stop being true: spelled out, this label does not fit.
    const spelled = "bachha sandil — 60 Black · 25, 26, 27, 28, 29, 30 waiting";
    expect(spelled.length).toBeGreaterThan(PHONE_LABEL_LIMIT);

    const compact = `bachha sandil — 60 Black · ${compactSizeRun("25, 26, 27, 28, 29, 30")}`;
    expect(compact.length).toBeLessThanOrEqual(PHONE_LABEL_LIMIT);
  });
});

describe("what the option shows", () => {
  it("puts the size on the option, compacted", async () => {
    const form = await screen();
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the call inside the label, not as the import: importing the
    // helper and never calling it is exactly the bug this exists to catch.
    expect(code, "the run must be compacted for the label").toMatch(
      /compactSizeRun\(\s*run\.sizeRun\s*\)/,
    );
  });

  it("puts the compacted size into the label it returns", () => {
    // Called, not read. Every source-text check here passed on a version that
    // computed the size and then threw it away — the label read "60 Black"
    // with the file still full of the right words. Only the returned string
    // can tell the difference.
    expect(waitingCounts([{ colour: "Black", sizeRun: "25, 26, 27, 28, 29, 30", pairs: 60 }], 60))
      .toBe("60 Black · 25-30");
  });

  it("names the size once when two colours share a run", () => {
    // Saying "36-41" twice on one line says the same thing twice and puts the
    // label back over a phone's width.
    expect(
      waitingCounts(
        [
          { colour: "Black", sizeRun: "36/41", pairs: 60 },
          { colour: "cherry", sizeRun: "36, 37, 38, 39, 40, 41", pairs: 40 },
        ],
        100,
      ),
    ).toBe("60 Black + 40 cherry · 36-41");
  });

  it("leaves the size off when the two runs are different", () => {
    // Two different runs cannot share one label, and naming both overflows.
    // The colours still answer "sixty of which?", which is the question asked.
    expect(
      waitingCounts(
        [
          { colour: "Black", sizeRun: "25-30", pairs: 60 },
          { colour: "cherry", sizeRun: "36-41", pairs: 40 },
        ],
        100,
      ),
    ).toBe("60 Black + 40 cherry");
  });

  it("falls back to the bare total past two runs", () => {
    const runs = [
      { colour: "Black", sizeRun: "36-41", pairs: 20 },
      { colour: "cherry", sizeRun: "36-41", pairs: 20 },
      { colour: "White", sizeRun: "36-41", pairs: 20 },
    ];
    expect(waitingCounts(runs, 60)).toBe("60");
  });

  it("drops the word that the size replaced", async () => {
    const form = await screen();
    const code = form.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // "waiting" and the size cannot both fit. Keeping both is how the label
    // goes back over the limit without anyone noticing.
    const waitingLabel = code.match(/`\s*—\s*\$\{waitingCounts[^`]*`/g) ?? [];
    expect(waitingLabel.length, "the waiting label moved").toBeGreaterThan(0);
    for (const label of waitingLabel) {
      // Only the literal text counts: `item.uppersWaiting` is the count being
      // read, so matching the whole expression would fail on correct code.
      const literal = label.replace(/\$\{[^}]*}/g, "");
      expect(literal, "the size replaced this word").not.toMatch(/waiting|पर्खिरहेको/);
    }
  });

  it("still says when nothing is waiting", async () => {
    const form = await screen();

    // An item with no uppers must still be choosable and must still say so —
    // that is how a brand-new shoe gets its first upper recorded.
    expect(form).toMatch(/no uppers waiting/);
  });
});
