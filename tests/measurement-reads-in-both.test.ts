import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The measurement page, read by somebody who pressed ENGLISH.
 *
 * Two things went wrong there and both were mine. The steps were numbered १२३४
 * on a page otherwise translated, so a reader who cannot read Devanagari met
 * Nepali numerals in the one place a numbered list has to be followed in order.
 * And the trackers were joined with " and ", which turned a list of two into
 * "Facebook and Instagram and Google" — because the first item is itself a pair
 * of names.
 *
 * The owner found both by opening the page. That is the check that matters, and
 * it is the one no test had been doing.
 */

const PAGE = "app/admin/measurement/page.tsx";

describe("the measurement page reads in both languages", () => {
  const source = readFileSync(PAGE, "utf8");

  it("numbers its steps in the digits the reader counts with", () => {
    // १२३४ hard-coded on an English page is the same fault as a Nepali
    // sentence there — worse, in a numbered list, because the order is the
    // whole point of the numbering.
    for (const [ne, en] of [["१", "1"], ["२", "2"], ["३", "3"], ["४", "4"]]) {
      expect(source, `step ${en} is paired`).toContain(`<T en="${en}." ne="${ne}." />`);
    }
    expect(source).not.toMatch(/>[१२३४]\.<\/strong>/);
  });

  it("names each tracker shortly when listing several", () => {
    // The Meta card says "Facebook and Instagram", which is what Meta covers
    // and belongs there. In a list it makes every sentence read "Facebook and
    // Instagram and Google", so a list uses the short name.
    expect(source).toContain('shortEn: "Facebook"');
    expect(source).toContain('shortNe: "Facebook"');

    // And every sentence that lists trackers uses the short form.
    expect(source).not.toMatch(/(live|missing)\.map\(\(t\) => t\.nepali(En)?\)/);
  });

  it("joins a list the way a sentence would", () => {
    const helper = source.slice(source.indexOf("function asSentence"));

    // Two names take "and"; three take commas and then "and". join(" and ")
    // gives "a and b and c", which reads like a child counting.
    expect(helper).toContain('rest.join(", ")');
    expect(helper).toContain("names.length === 1");
    expect(source).not.toContain('.join(" and ")');
    expect(source).not.toContain('.join(" र ")');
  });

  it("reports what production runs, not what this machine runs", () => {
    // The Meta pixel id lives in the code because it is not a secret — it
    // ships in the HTML of every page. So this screen must read the same
    // source the shop's own tags read, or it will report a live tracker as
    // missing, which is the one lie that would make the page worse than not
    // having it.
    expect(source).toContain("configuredTrackingIds()");
    expect(source).not.toContain("activeTrackingIds");
  });
});
