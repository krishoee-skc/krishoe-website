import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every box a person types in can say what it is for.
 *
 * A control with no name is announced as "edit box" and nothing else. The
 * label sitting above it on screen is, to a screen reader, unrelated text — so
 * the person filling a wage entry hears "edit box, 60" and has to guess which
 * of the seven boxes on that form they are in.
 *
 * It is not only a reader's problem. The browser's own autofill, a password
 * manager, and voice control ("type sixty in number of pairs") all work from
 * the same names, so an unnamed box is worse for everyone.
 *
 * Four things give a control its name, and any one is enough:
 *
 *   - an enclosing <label> — the common shape here, and perfectly valid
 *   - id, paired with <label htmlFor>
 *   - aria-label
 *   - aria-labelledby
 *
 * This test holds the rule rather than a count: a new form written next month
 * fails here the day it is added, instead of being found by somebody who
 * cannot use it.
 */
const ROOTS = ["app", "components"];

/** Controls that carry no name by nature and need none. */
function needsAName(tag: string, attrs: string) {
  if (/type="(hidden|button|submit|reset|image)"/.test(attrs)) return false;
  return tag === "input" || tag === "select" || tag === "textarea";
}

/**
 * Whether this control sits inside a <label>.
 *
 * Counted rather than pattern-matched: a label may wrap several lines of JSX
 * with the control deep inside, and only the balance of opening and closing
 * tags before this point can say whether we are still within one.
 */
function insideLabel(source: string, at: number) {
  const before = source.slice(0, at);
  const opens = (before.match(/<label\b/g) ?? []).length;
  const closes = (before.match(/<\/label>/g) ?? []).length;
  return opens > closes;
}

/**
 * Every input/select/textarea opening tag, with its attribute run.
 *
 * Walks from the tag name to the ">" that closes it, tracking {} depth and
 * quotes so a ">" inside an expression does not end the tag early.
 */
function openingTags(source: string) {
  const out: { tag: string; attrs: string; index: number }[] = [];
  const opener = /<(input|select|textarea)\b/g;
  let m: RegExpExecArray | null;

  while ((m = opener.exec(source))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote = "";

    for (; i < source.length; i += 1) {
      const c = source[i];
      if (quote) {
        if (c === quote) quote = "";
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        quote = c;
        continue;
      }
      if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) break;
    }
    if (i >= source.length) continue;

    out.push({ tag: m[1], attrs: source.slice(m.index + m[0].length, i), index: m.index });
    opener.lastIndex = i + 1;
  }
  return out;
}

function unnamedControls() {
  const found: { file: string; line: number }[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;

      // Comments are prose, not markup. Three files explain the date picker by
      // writing "a plain <input type=\"date\">" in a doc comment, and a scan
      // that counts those reports three faults that cannot be fixed, because
      // there is nothing there to name. Blanked rather than removed, so every
      // offset below still points at the right line.
      const source = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, (block) =>
        block.replace(/[^\n\r]/g, " "),
      );
      // Each tag's real end, not the first ">".
      //
      // JSX attributes run over many lines and their {...} expressions contain
      // ">" of their own — arrow functions, comparisons — so a [^>] match ends
      // inside an expression and a dotAll match runs into the next element.
      // Either way an aria-label further down the tag is missed, and a control
      // that is correctly named is reported as a fault. Scanned instead, with
      // brace and quote depth tracked.
      for (const match of openingTags(source)) {
        const { tag, attrs } = match;
        if (!needsAName(tag, attrs)) continue;
        if (/\bid=/.test(attrs)) continue;
        if (/aria-label/.test(attrs)) continue;
        if (insideLabel(source, match.index)) continue;

        found.push({
          file: path.split("\\").join("/"),
          line: source.slice(0, match.index).split(/\r?\n/).length,
        });
      }
    }
  }

  for (const root of ROOTS) walk(root);
  return found;
}

describe("form controls", () => {
  it("can all say what they are for", () => {
    const unnamed = unnamedControls();

    const report = unnamed
      .slice(0, 40)
      .map((c) => `  ${c.file}:${c.line}`)
      .join("\n");

    expect(
      unnamed.length,
      `${unnamed.length} control(s) have no name — a screen reader says only "edit box":\n${report}`,
    ).toBe(0);
  });

  it("finds controls at all, so the check cannot pass by reading nothing", () => {
    // The guard on the guard. If the walk broke, every control would be
    // "named" and this suite would go quietly green on a real regression.
    let total = 0;
    function count(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) count(path);
        else if (entry.name.endsWith(".tsx")) {
          total += (readFileSync(path, "utf8").match(/<(input|select|textarea)\b/g) ?? []).length;
        }
      }
    }
    for (const root of ROOTS) count(root);

    expect(total, "no form controls found — the scan is broken").toBeGreaterThan(100);
  });
});
