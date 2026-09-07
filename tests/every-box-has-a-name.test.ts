import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A box nobody can name.
 *
 * A screen reader announces an input by its accessible name. Without one it
 * says "edit text, blank" — so a form becomes a row of unnamed boxes, and the
 * person filling it in is guessing which is which.
 *
 * A name can come from four places, all of them fine:
 *   - the control sits inside its own <label>
 *   - a <label htmlFor> points at its id
 *   - aria-label / aria-labelledby says it outright
 *   - a placeholder, which at least announces something (it disappears once
 *     the box is typed in, so it is the weakest of the four, but it is a name)
 *
 * Every control in the app has one of those now, and this keeps it that way.
 */

/**
 * A comment explaining `<input type="month">` is not a control on the page.
 * Blanked rather than deleted so the line numbers in a failure still point at
 * the right place.
 */
function blankComments(source: string) {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:"'`])\/\/[^\n]*/g, blank);
}

/**
 * The attributes of one tag.
 *
 * Not `<input[^>]*>`: an arrow function in an onChange contains a ">", so that
 * pattern gives up halfway through the tag and never sees the aria-label
 * further along — which reports named controls as unnamed. This tracks strings
 * and braces and stops at the ">" that actually closes the tag.
 */
function tagAttributes(source: string, startIndex: number) {
  let index = startIndex;
  let depth = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const character = source[index];

    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    } else if (character === ">" && depth === 0) {
      return source.slice(startIndex, index);
    }

    index += 1;
  }

  return source.slice(startIndex);
}

async function tsxFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await tsxFiles(path, out);
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

async function unnamedControls() {
  const files = [...(await tsxFiles("app")), ...(await tsxFiles("components"))];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const found: string[] = [];

  files.forEach((file, index) => {
    const source = blankComments(sources[index]);

    for (const match of source.matchAll(/<(input|select|textarea)\b/g)) {
      const attributes = tagAttributes(source, (match.index ?? 0) + match[0].length);

      // A hidden field carries a value nobody types, and a file input driven by
      // its own button is reached through that button.
      if (/type=["']?(hidden|submit|button)/.test(attributes)) continue;
      if (/\bhidden\b/.test(attributes)) continue;
      if (/aria-label|aria-labelledby|\bid=|placeholder=/.test(attributes)) continue;

      const before = source.slice(0, match.index);
      const opened = (before.match(/<label\b/g) ?? []).length;
      const closed = (before.match(/<\/label>/g) ?? []).length;
      if (opened > closed) continue;

      found.push(`${file}:${before.split("\n").length}`);
    }
  });

  return found;
}

describe("every box a person types in", () => {
  it("has a name a screen reader can read out", async () => {
    const found = await unnamedControls();

    // Named, not counted: "expected 1 to be 0" sends the reader hunting through
    // five hundred files.
    expect(found.join("\n"), "Controls with no accessible name").toBe("");
  });
});
